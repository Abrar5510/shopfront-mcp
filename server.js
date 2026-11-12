// HTTP entry point: static pages, the JSON API, and one MCP endpoint per shop.
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { aiEnabled, generateListings, summarizeGaps } from "./lib/ai.js";
import { buildShopServer } from "./lib/mcp.js";
import { slugify, verifyCapture } from "./lib/shop.js";
import { load, save } from "./lib/store.js";

const PORT = process.env.PORT || 3000;
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "sb";

const app = express();
app.set("trust proxy", 1); // Render terminates TLS; this makes req.protocol report https
app.use(express.json({ limit: "200kb" }));
app.use(express.static(new URL("./public", import.meta.url).pathname));

const baseUrl = (req) => process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;

// Loads the shop named in the URL or ends the request with a 404.
function shopOr404(req, res) {
  const shop = load().shops[req.params.shop];
  if (!shop) res.status(404).json({ error: "No such shop." });
  return shop;
}

app.get("/api/config", (req, res) => res.json({ paypalClientId: PAYPAL_CLIENT_ID, aiEnabled }));

// --- Merchant onboarding ---------------------------------------------------------------------

app.post("/api/shops", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const policies = String(req.body?.policies ?? "").trim();
  const rawProducts = String(req.body?.products ?? "").trim();
  if (name.length < 2 || name.length > 60) return res.status(400).json({ error: "Shop name must be 2 to 60 characters." });
  if (!slugify(name)) return res.status(400).json({ error: "Shop name needs at least one letter or number." });
  if (rawProducts.length < 5 || rawProducts.length > 20000) return res.status(400).json({ error: "Paste your products (up to 20,000 characters)." });
  if (policies.length > 2000) return res.status(400).json({ error: "Policies must be under 2,000 characters." });

  const listings = await generateListings(rawProducts);
  if (!listings.length) return res.status(400).json({ error: "Couldn't find any products with a price. Put each product on its own line with its price." });

  const db = load();
  let slug = slugify(name);
  for (let n = 2; db.shops[slug]; n++) slug = `${slugify(name)}-${n}`;
  db.shops[slug] = { name, policies, products: listings.map((l, i) => ({ id: `p${i + 1}`, ...l })) };
  save(db);
  res.status(201).json({ slug, mcpUrl: `${baseUrl(req)}/mcp/${slug}`, dashboardUrl: `${baseUrl(req)}/dash.html?shop=${slug}`, products: db.shops[slug].products });
});

app.get("/api/shops/:shop", (req, res) => {
  const shop = shopOr404(req, res);
  if (shop) res.json({ ...shop, mcpUrl: `${baseUrl(req)}/mcp/${req.params.shop}` });
});

// --- MCP: what AI agents talk to -------------------------------------------------------------

app.post("/mcp/:shop", async (req, res) => {
  const shop = shopOr404(req, res);
  if (!shop) return;
  const server = buildShopServer(req.params.shop, shop, baseUrl(req));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => { transport.close(); server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// Stateless server: no SSE stream to open and no session to delete.
app.all("/mcp/:shop", (req, res) => {
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. Use POST." }, id: null });
});

// --- Checkout --------------------------------------------------------------------------------

app.get("/api/carts/:id", (req, res) => {
  const db = load();
  const cart = db.carts[req.params.id];
  if (!cart) return res.status(404).json({ error: "No such cart." });
  res.json({ ...cart, shopName: db.shops[cart.shop]?.name ?? cart.shop });
});

app.post("/api/carts/:id/paid", (req, res) => {
  const db = load();
  const cart = db.carts[req.params.id];
  // ponytail: trusts the capture the browser reports, after checking status and amount against our cart.
  // With a sandbox client secret, confirm here via GET /v2/checkout/orders/{id} before marking paid.
  const result = verifyCapture(cart, req.body);
  if (result.error) return res.status(cart ? 409 : 404).json({ error: result.error });
  Object.assign(cart, result, { status: "paid", paidAt: new Date().toISOString() });
  save(db);
  res.json({ ok: true });
});

// --- Merchant dashboard ----------------------------------------------------------------------

app.get("/api/shops/:shop/activity", (req, res) => {
  if (!shopOr404(req, res)) return;
  const db = load();
  const carts = Object.values(db.carts).filter((c) => c.shop === req.params.shop);
  const orders = carts.filter((c) => c.status === "paid").sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  res.json({
    orders,
    pendingCheckouts: carts.length - orders.length,
    revenue: orders.reduce((cents, o) => cents + Math.round(o.total * 100), 0) / 100,
    events: db.events.filter((e) => e.shop === req.params.shop).slice(-50).reverse(),
  });
});

const isMiss = (e) => (e.tool === "search_products" && e.hits === 0) || (e.tool === "ask_shop" && e.answered === false);
const insightsCache = new Map(); // shop slug -> { missCount, gaps }; avoids an AI call on every dashboard poll

app.get("/api/shops/:shop/insights", async (req, res) => {
  const shop = shopOr404(req, res);
  if (!shop) return;
  const misses = load().events.filter((e) => e.shop === req.params.shop && isMiss(e));
  const cached = insightsCache.get(req.params.shop);
  if (cached?.missCount === misses.length) return res.json({ gaps: cached.gaps });
  const gaps = await summarizeGaps(shop, misses);
  insightsCache.set(req.params.shop, { missCount: misses.length, gaps });
  res.json({ gaps });
});

// Express 5 forwards rejected async handlers here.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.status === 400 ? "Invalid request body." : "Something went wrong on our side." });
});

app.listen(PORT, () => console.log(`Shopfront MCP on http://localhost:${PORT} (AI ${aiEnabled ? "on" : "off: fallback mode"})`));
