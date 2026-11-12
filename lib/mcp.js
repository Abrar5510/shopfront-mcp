// One MCP server per shop. Built fresh for each request (stateless), so there are no sessions to track.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { answerQuestion } from "./ai.js";
import { buildCart, searchProducts } from "./shop.js";
import { load, logEvent, newId, save } from "./store.js";

const json = (data) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const failure = (message) => ({ content: [{ type: "text", text: message }], isError: true });

export function buildShopServer(slug, shop, baseUrl) {
  const server = new McpServer({ name: `shopfront-${slug}`, version: "1.0.0" });

  server.registerTool("shop_info", {
    description: `Get ${shop.name}'s policies (pickup, delivery, refunds, lead times) and how ordering works. Call this first.`,
    inputSchema: {},
  }, async () => {
    logEvent(slug, { tool: "shop_info" });
    return json({
      name: shop.name,
      policies: shop.policies,
      productCount: shop.products.length,
      howToOrder: "Find items with search_products, then call create_checkout and give the buyer the checkoutUrl. They pay with PayPal on that page.",
    });
  });

  server.registerTool("search_products", {
    description: `Search ${shop.name}'s catalog. Returns products with id, price in USD and attributes such as allergens and dietary info. An empty query lists everything.`,
    inputSchema: { query: z.string().max(200).describe("Keywords, e.g. 'gluten-free cupcakes'") },
  }, async ({ query }) => {
    const products = searchProducts(shop, query);
    logEvent(slug, { tool: "search_products", text: query, hits: products.length });
    return json({ products, note: products.length ? undefined : "No match. Try broader keywords or an empty query to see the full catalog." });
  });

  server.registerTool("ask_shop", {
    description: `Ask ${shop.name} a question the listings may not cover (custom orders, ingredients, timing). Answers come only from what the shop has published.`,
    inputSchema: { question: z.string().min(3).max(500) },
  }, async ({ question }) => {
    const result = await answerQuestion(shop, question);
    logEvent(slug, { tool: "ask_shop", text: question, answered: result.answered });
    return json(result);
  });

  server.registerTool("create_checkout", {
    description: "Create a PayPal checkout for the buyer. Returns a checkoutUrl: give it to the user so they can review and pay. The order is NOT paid until they complete PayPal on that page, so never claim it is.",
    inputSchema: {
      items: z.array(z.object({
        id: z.string().describe("Product id from search_products"),
        qty: z.number().int().min(1).max(99),
      })).min(1).max(20),
      note: z.string().max(300).optional().describe("Buyer's note for the shop, e.g. pickup day or cake message"),
    },
  }, async ({ items, note }) => {
    let cart;
    try {
      cart = buildCart(shop, items);
    } catch (err) {
      return failure(err.message);
    }
    const id = newId("c");
    const db = load();
    db.carts[id] = { id, shop: slug, ...cart, note: note ?? "", status: "pending", createdAt: new Date().toISOString() };
    db.events.push({ shop: slug, at: new Date().toISOString(), tool: "create_checkout", text: cart.items.map((i) => `${i.qty}× ${i.name}`).join(", ") });
    save(db);
    return json({ checkoutUrl: `${baseUrl}/pay.html?cart=${id}`, total: cart.total, currency: "USD", items: cart.items, status: "awaiting payment" });
  });

  return server;
}
