# Build plan: Shopfront MCP

**One line:** a small merchant uploads products, AI turns them into agent-readable listings, and the shop gets its own MCP server so any AI assistant can search it and send the buyer a PayPal checkout link.

**Deadline:** Fri Nov 13, 1:00 AM GMT+5. Everything below is sized to fit that.

**Constraint:** no PayPal developer account. All PayPal use goes through the JS SDK with the public sandbox ID `client-id=sb`, in the browser. No client secret anywhere.

---

## Step 0 (do this first, 10 minutes): prove `sb` can take a payment

If this fails, the whole plan changes, so test it before writing anything else.

Save as `sbtest.html`, open it through any local server (`npx serve .`), click the button, pay as guest with a sandbox test card.

```html
<div id="b"></div>
<script src="https://www.paypal.com/sdk/js?client-id=sb&currency=USD"></script>
<script>
paypal.Buttons({
  createOrder: (d, a) => a.order.create({
    purchase_units: [{ amount: { value: "1.00", currency_code: "USD" } }]
  }),
  onApprove: (d, a) => a.order.capture().then(o => {
    document.body.append(JSON.stringify(o, null, 2));
  }),
  onError: e => document.body.append("ERROR " + e)
}).render("#b");
</script>
```

- **Pass** = JSON printed with `"status": "COMPLETED"` and an order `id`. Continue to step 1.
- Test cards: PayPal's "card testing" docs page on developer.paypal.com lists sandbox card numbers. Use any future expiry and any CVV.
- **Fail** (button won't render, or capture errors): stop. Ask in the PayPal Discord (https://discord.gg/sJ2G6DyvSK) for sandbox credentials, or get a friend abroad to create a sandbox app and send you its **sandbox** client ID. Swap `sb` for that ID; nothing else in this plan changes.

---

## Stack (deliberately tiny)

| Piece | Choice | Why |
|---|---|---|
| Server | Node 20+, Express, one `server.js` | one process serves API, MCP, and pages |
| Storage | one `data.json` file, read/write whole file | no database to set up; fine for a demo |
| MCP | `@modelcontextprotocol/sdk`, Streamable HTTP, stateless | works as a remote connector in Claude |
| AI | `@anthropic-ai/sdk`, model `claude-haiku-5-5` | cheap and fast; needs `ANTHROPIC_API_KEY` |
| Frontend | 3 plain HTML files, no framework, no build step | nothing to compile or break |
| PayPal | JS SDK `client-id=sb` on the pay page | the only option without an account |
| Hosting | Render free web service | sponsor prize + public HTTPS URL for MCP |

```bash
npm init -y && npm i express @modelcontextprotocol/sdk @anthropic-ai/sdk zod
```

Set `"type": "module"` in `package.json` and `"start": "node server.js"`.

## Files

```
server.js            everything server-side (~250 lines)
public/index.html    merchant onboarding: paste products, get MCP URL
public/pay.html      checkout page with PayPal buttons
public/dash.html     merchant dashboard: orders + agent questions + AI insights
data.json            created at runtime (gitignored)
seed.json            one demo shop (a bakery) so the hosted demo is never empty
README.md  LICENSE (MIT)  .env.example  .gitignore
```

## Data shape (`data.json`)

```json
{
  "shops":  { "sweet-crumb": { "name": "Sweet Crumb Bakery", "policies": "...", "products": [
      { "id": "p1", "name": "Gluten-free cupcakes (dozen)", "price": 36.00,
        "description": "...", "attributes": { "allergens": ["egg","dairy"], "glutenFree": true, "leadTimeDays": 1 } } ] } },
  "carts":  { "c_ab12": { "shop": "sweet-crumb", "items": [{ "id": "p1", "qty": 1 }], "total": 36.00,
                          "status": "pending", "paypalOrderId": null, "createdAt": "..." } },
  "events": [ { "shop": "sweet-crumb", "tool": "search_products", "query": "vegan cupcakes", "hits": 0, "at": "..." } ]
}
```

Prices are stored in the product and the cart total is always computed on the server from them. The agent and the browser never supply a price.

---

## Build order

### 1. Server skeleton and storage (30 min)

- `load()` / `save()` helpers that read and write `data.json`; on first run copy `seed.json`.
- `express.json()`, `express.static("public")`.
- Routes to add as you go:

| Route | Does |
|---|---|
| `POST /api/shops` | onboarding (step 2) |
| `GET /api/shops/:shop` | shop + products, for the dashboard |
| `ALL /mcp/:shop` | the shop's MCP server (step 3) |
| `GET /api/carts/:id` | cart for the pay page |
| `POST /api/carts/:id/paid` | pay page reports the capture (step 4) |
| `GET /api/shops/:shop/orders` | paid carts, for the dashboard |
| `GET /api/shops/:shop/insights` | AI summary of agent questions (step 5) |

### 2. Merchant onboarding with AI listings (1 hour)

`public/index.html`: shop name, a policies box (delivery area, pickup hours), and one big textarea where the merchant pastes products however they have them (a messy list, a CSV, menu text).

`POST /api/shops` sends that text to Claude and asks for strict JSON:

```js
const msg = await anthropic.messages.create({
  model: "claude-haiku-5-5", max_tokens: 4000,
  system: "You turn a small merchant's raw product notes into listings an AI shopping agent can reason about. Return ONLY a JSON array. Each item: {name, price (number, USD), description (2 sentences, factual), attributes: {allergens[], dietary[], sizes[], leadTimeDays, anything else an agent would need to answer a buyer}}. Never invent a price; skip items with no price.",
  messages: [{ role: "user", content: rawText }]
});
```

- `JSON.parse` the reply inside `try/catch`; on failure return a 400 with "couldn't read that, try again".
- Give each product an id, save under a slug of the shop name.
- Respond with the shop's MCP URL (`https://<host>/mcp/<slug>`) and dashboard link. The page shows both, with a "copy" button and one line: "Add this URL as a connector in your AI assistant."

Skipped: photo upload, CSV parser, editing listings. Pasted text covers all three for the demo.

### 3. The MCP server (1.5 hours) — the core of the project

Stateless Streamable HTTP: build a fresh server per request, so there are no sessions to manage.

```js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

app.all("/mcp/:shop", async (req, res) => {
  const db = load(), shop = db.shops[req.params.shop];
  if (!shop) return res.status(404).json({ error: "no such shop" });
  const server = buildShopServer(req.params.shop, shop, req);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => { transport.close(); server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
```

`buildShopServer` registers four tools with `server.tool(name, description, zodShape, handler)`. Every handler appends a row to `events` before returning.

| Tool | Input | Returns |
|---|---|---|
| `shop_info` | none | name, policies, how ordering works |
| `search_products` | `query: string` | matching products with full attributes. Match = every query word appears in name/description/attributes JSON, lowercase. Log `hits`. |
| `ask_shop` | `question: string` | answers from policies + listings via one Claude call; if the listings don't cover it, reply "the shop hasn't published that" and log the event with `answered: false` |
| `create_checkout` | `items: [{id, qty}]`, optional `note` | validates ids and `qty` 1–99, computes total server-side, saves a cart, returns `{ checkoutUrl: "https://<host>/pay.html?cart=<id>", total, items }` |

Write the tool descriptions for the agent, e.g. `create_checkout`: "Creates a PayPal checkout for the buyer. Return the checkoutUrl to the user; they pay there. Never claim the order is paid."

**Check it works** before moving on:

```bash
npx @modelcontextprotocol/inspector
```

Connect to `http://localhost:3000/mcp/sweet-crumb`, call each tool, open the returned `checkoutUrl`.

### 4. Pay page and capture (1 hour) — the PayPal part

`public/pay.html` reads `?cart=`, fetches `/api/carts/:id`, shows shop name, line items, total, then:

```js
paypal.Buttons({
  createOrder: (d, a) => a.order.create({
    purchase_units: [{
      reference_id: cart.id,
      description: `Order from ${cart.shopName}`,
      amount: { currency_code: "USD", value: cart.total.toFixed(2),
        breakdown: { item_total: { currency_code: "USD", value: cart.total.toFixed(2) } } },
      items: cart.items.map(i => ({ name: i.name, quantity: String(i.qty),
        unit_amount: { currency_code: "USD", value: i.price.toFixed(2) } }))
    }]
  }),
  onApprove: (d, a) => a.order.capture().then(order =>
    fetch(`/api/carts/${cart.id}/paid`, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify(order) })
    .then(() => showReceipt(order))),
  onError: e => showError("Payment didn't go through. Nothing was charged.")
}).render("#paypal");
```

`POST /api/carts/:id/paid` on the server:
- reject unless cart exists and is `pending` (stops double reporting)
- reject unless `order.status === "COMPLETED"` and the captured amount equals the server's cart total
- store `paypalOrderId`, capture id, payer name/email from the order, set `status: "paid"`

**Known ceiling, say it in the README:** the server takes the browser's word for the capture because verifying needs a client secret. With sandbox credentials the fix is one call: `GET /v2/checkout/orders/{id}` from the server. Leave a `// ponytail:` comment at that spot.

### 5. Merchant dashboard (1.5 hours)

`public/dash.html?shop=<slug>`, polls every 3 seconds. Three panels:

1. **Orders placed by AI agents**: time, items, total, payer, PayPal order ID, status. New rows flash, which is the demo moment.
2. **What agents asked**: the raw `events` feed (tool, query, hits/answered).
3. **Listing gaps**: `GET /api/shops/:shop/insights` sends events where `hits === 0` or `answered === false` to Claude: "Group these into at most 5 gaps. For each: what buyers wanted, how many times, and the exact sentence to add to a listing or policy." Render as cards. Cache the result until the event count changes so polling doesn't burn API calls.

Design matters (it's 1 of 5 criteria): one accent colour, generous spacing, a big total at the top ("$ earned from AI agents"). Don't spend more than 30 minutes of the 1.5 hours on styling.

### 6. Deploy to Render (30 min)

- Push to a **public GitHub repo** with an **MIT `LICENSE`** file (check GitHub's About sidebar shows "MIT license").
- Render → New Web Service → the repo → build `npm install`, start `npm start`, env var `ANTHROPIC_API_KEY`.
- Free tier sleeps and its disk resets on restart. That is why `seed.json` exists: the demo shop comes back on every boot. Hit the URL a minute before recording.
- Add the hosted MCP URL to Claude as a custom connector (Settings → Connectors → Add custom connector) and run the full demo once.

### 7. README, video, submit (2.5 hours — don't shrink this)

**README:** problem, demo GIF, architecture diagram (agent → MCP → cart → PayPal JS SDK → dashboard), run steps, `.env.example`, the trust-boundary note from step 4, hosted URL, and testing notes (which test card page to use).

**Video, under 3:00:**
- 0:00–0:20 Maria runs a bakery. People now ask AI assistants where to buy; her shop is invisible to them.
- 0:20–0:50 She pastes her menu. Listings appear. She gets an MCP URL.
- 0:50–1:50 In Claude: "Order a dozen gluten-free cupcakes for Saturday under $40." Claude searches, asks about allergens, returns the checkout link. Pay in the PayPal sandbox. Show `COMPLETED`.
- 1:50–2:20 Dashboard: the order appears. "Listing gaps" shows "3 agents asked for vegan options — add this line."
- 2:20–2:40 Architecture slide naming PayPal JS SDK / Orders and Claude.
- 2:40–2:50 Why it matters: every other entry builds the buyer's agent; this gives the seller a door.

Use invented product names. No music you don't own. **Upload to YouTube by 9 PM GMT+5**; processing can take hours.

**Devpost form:** tick **Render**, list Claude under AI tools with how it's used (listing generation, `ask_shop` answers, gap analysis), paste hosted URL, repo, video. Submit a draft early, then edit.

---

## Timeline (GMT+5, assuming a start around 1 PM)

| Time | Work |
|---|---|
| 1:00–1:15 | Step 0: `sb` test |
| 1:15–2:45 | Steps 1–2: server, onboarding, seed shop |
| 2:45–4:15 | Step 3: MCP tools, verified in the inspector |
| 4:15–5:15 | Step 4: pay page and capture |
| 5:15–6:45 | Step 5: dashboard and insights |
| 6:45–7:30 | Step 6: deploy, full run through Claude |
| 7:30–9:00 | Record and upload video |
| 9:00–11:00 | README, Devpost form, buffer |
| 11:00 PM | Submit. Two hours of slack before 1:00 AM. |

If you start later, cut in this order: `ask_shop` tool → onboarding page (ship with the seed shop only) → insights caching. Never cut the pay page, the dashboard order feed, or the video.

## What is deliberately left out

- Logins and merchant accounts: the dashboard URL is the access. Add auth if this ever holds real orders.
- Webhooks, Catalog, Shipment Tracking, server-side order verification: all need a client secret.
- A database: `data.json` holds until two requests write at the same instant.
- Shipping and tax quotes: pickup/local delivery only, stated in shop policies.

## If sandbox credentials turn up before the deadline

Worth about one hour, in this order, for a better Technical Implementation score:
1. Verify the capture server-side (`GET /v2/checkout/orders/{id}`).
2. Create the order server-side (Orders v2) so `create_checkout` returns PayPal's own approval link.
3. Sync listings to Catalog Products.
