# PayPal AI Hackathon — Specs, Competitive Scan & Winning Ideas

Source: https://paypalaihackathon.devpost.com (overview, rules, resources, FAQs, updates, discussions, sponsor pages), Devpost public project search, github.com/paypal/agent-toolkit. Scanned 2026-11-11.

---

## 1. Hard facts

| Item | Value |
|---|---|
| **Deadline** | **Thu Nov 12, 2026, 12:00 PM PT** = **Fri Nov 13, 1:00 AM GMT+5**. About 1.5 days from scan time. |
| Judging | Dec 1 – Dec 15, 2026 |
| Winners | ~Dec 21, 2026 |
| Participants | 33,604 registered |
| Format | Online. Solo, team (no max size) or organization |
| Tracks | **None.** Open innovation, no problem statements |
| Only real requirement | Project must **meaningfully use BOTH PayPal and AI**, and PayPal must be **central** |
| Ineligible | Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea, OFAC-sanctioned places; PayPal/Devpost staff, judges, and their families |
| PayPal family counts | Venmo, Braintree, Xoom, Honey, Zettle, Paidy, Hyperwallet, etc. |
| New vs existing | Either works, but an existing project must be *significantly* updated after Oct 1, and you must say what changed |
| Multiple entries | Allowed if each is substantially different |

## 2. Submission checklist (failing any one = out at Stage One)

- [ ] Working build using the **PayPal sandbox** plus an AI model, tool or platform
- [ ] **Text description** covering features and functionality
- [ ] **Functional demo**: a hosted URL (recommended) **or** full run instructions in the repo. Mockups and static prototypes fail.
- [ ] **Tools section**: which AI models/services you used and how
- [ ] **Public repo** (GitHub, GitLab or Bitbucket) with all source, assets and instructions
- [ ] **Open-source LICENSE file**, detected and shown in the repo's About sidebar (e.g. MIT)
- [ ] **YouTube video, public, under 3:00**, showing it running on its target device
- [ ] No third-party trademarks or copyrighted music in the video. Use made-up product names ("Headphones A"); organizers confirmed this in the forum.
- [ ] English (or translations provided)
- [ ] If you're going for a sponsor prize, **tick the sponsor tools on the form**
- [ ] Teammates invited **and** accepted on Devpost
- [ ] Judges need no keys of their own: a hosted demo keeps your LLM key on your server. Never commit secrets. Put sandbox buyer logins in the testing instructions.
- [ ] Keep the demo, credits and trials **alive until Dec 21**
- [ ] **Don't touch the repo, video or README after the deadline** until winners are announced

## 3. Judging

- **Stage One (pass/fail):** working build, public licensed repo, public video under 3 min, meaningful PayPal + AI.
- **Stage Two:** each criterion scored 1–5, **equally weighted**:
  1. **Technological Implementation**: deep, non-trivial use of PayPal APIs and AI
  2. **Design**: a complete product experience, not just a tech proof of concept
  3. **Potential Impact**: a specific, credible real problem for a real audience, *and the demo shows it solved*
  4. **Innovation/Idea**: novel, different from existing concepts
  5. **Presentation**: the video shows it working end to end, with a clear problem, audience and why it matters
- **Ties** go to the earlier criterion (Tech Implementation first).
- Judges **don't have to run your project**, so **the video carries most of the weight**. Judging may also use AI-assisted analysis, so write a clear README and description.
- Judges: 6 from PayPal (DevRel, engineering, PM) plus one each from AG Grid, APIMatic, Bryntum, Channel3, Elastic, Postman and Render.

## 4. Prizes ($67.5k cash plus credits)

| Prize | Amount | Notes |
|---|---|---|
| 1st / 2nd / 3rd | $12k / $8k / $5k | |
| Most Creative | $5k | |
| Most Impactful | $5k | |
| Best Demo Delivery | $5k | won on the video |
| Best Use of PayPal + AI | $5k | |
| **Best Use of Agentic Commerce** | $5k | named by organizers as a starting point |
| AG Grid | $5k / $2k / 3×$1k | **crowded**: 43 of 150 recent PayPal projects tag ag-grid |
| APIMatic | 3×$1k plus 6 months Business | ~10 competitors. Just use the Context Plugin in Claude Code while building. |
| Bryntum | 3×$1k | ~10 competitors |
| **Channel3** | 1×$1.5k | ~12 competitors. Must actually call the API/MCP. |
| Render | $1k / $750 / $500 credits | credits only |

**Stacking rule:** one project can win at most **one Grand or Honorable Mention prize plus one Sponsor prize**. The sponsor prize is your safety net, so pick one.

Sponsor tools with no prize of their own: Astropods, Elastic, KERNEL, Postman, Zapier.

## 5. PayPal tech you can use

- **Agent Toolkit** (`npm i @paypal/agent-toolkit`, Python too). Works with Vercel AI SDK, OpenAI Agents SDK, LangChain and MCP. Set `context: { sandbox: true }`. Tools it exposes:
  - Invoices: create/send/remind/cancel, QR code, **recurring series**, **conditional rules (early-pay discount, auto-cancel)**, record payment or refund
  - Orders: create, get, pay, refund
  - Disputes: list, get, accept
  - Shipment tracking: create, get, update
  - Catalog products: create, list, show
  - **Subscriptions**: plans, create, update, cancel
  - Reporting: `list_transactions`, **`get_merchant_insights`**
- **Hosted MCP:** `mcp.sandbox.paypal.com`. **Flaky.** Since Oct 29 it has been returning `PAYPAL_API_SETUP_ERROR: Unsupported cache mode` (agent-toolkit issue #119). **Call the REST API or the local toolkit instead of the hosted MCP.**
- REST: Orders v2 (CAPTURE/AUTHORIZE), Payouts, Invoicing, Subscriptions, Disputes, Webhooks, Transaction Search, Vault, Pay Later, Donations, Payment Links, JS SDK v6.
- **Sandbox gotchas** from the forum:
  - Vaulting on platform apps returns 403 `NOT_ENABLED_TO_VAULT_PAYMENT_SOURCE`. Workaround: `intent: AUTHORIZE` plus partial captures.
  - Sandbox business accounts registered in some countries can't receive payments. Create a **US sandbox business account**.
  - Some countries (Pakistan, Bangladesh, Libya, Iraq) can't sign up for PayPal. Ask in the PayPal Discord.
- Help: PayPal Discord https://discord.gg/sJ2G6DyvSK
- Docs: developer.paypal.com, github.com/paypal/agent-toolkit, github.com/paypaldev/getting-started-with-paypal-sandbox

---

## 6. What people are already building

The official gallery isn't published yet. Devpost's public search shows **1,356 PayPal-tagged projects**. I clustered the 179 most recent:

| Cluster | Approx. count | Examples | Verdict |
|---|---|---|---|
| **Guardrails/firewalls for AI agents spending money** (mandates, spend caps, approve-before-capture, prompt-injection checks) | **25+** | Countersign (×2), AgentGuard, Leash, LeashPay, Allowance (×2), CartMirror, Capture Gate, Interlock, Mandate Pay, MePal, ApproveAccept, WardLock, Railguard | **Avoid. Most saturated.** |
| Freelancer invoicing and late-payment chasing from chat or voice | 15+ | Settle, Owed, Kaasu, InvoicePilot, SayPaid, PaySay, Mercury Cmd, PayPromise, Ledgerline | Avoid |
| Escrow where AI verifies delivery or photos before capture | 12+ | Handshake, HoldProof, Handback, SmartEscrow, Escrow Agent, Make It Right, AgentTrust | Avoid |
| Donations with proof of delivery | 12+ | Proven, Kindtrail, Earmark, CareCircle, Stone-Soup, Plantago, Aloha Relief | Avoid |
| Dispute copilots | 10+ | DisputeGraph, Dispute Desk, DisputeShield, DisputePilot, Seller Agent | Avoid |
| Generic AI shopping agents | 10+ | AgentPay, TrustCart, MarketPulse, PAYMIND X | Avoid |
| Group money (trips, splits, savings circles) | 8 | TripPot, Wayledger, Rota, SaveCircle, Rotapot | Crowded |
| Voice payments | 5 | PayWhisper, Voice Checkout, VoiceTab | Crowded |
| Pre-orders and group buys | 4 | Batchday, Quorum, CommonGround | Medium |
| Payment dev and test tools | 4 | Rehearsal, Sandbox City, AI Payment Test Agent, Last Button | Medium |
| **Merchant side: making a shop buyable by AI agents** | **1** | Counter | **Open** |
| **Subscription merchant tools (retention, cancellation saves)** | **~1** | Resurrection (failed-payment recovery only) | **Open** |
| Recurring invoice series and conditional rules (new toolkit tools) | ~0 | none seen | **Open** |

Stack trends: React/Next and Node dominate, Claude ≈ Gemini > OpenAI. The same few safety ideas are everywhere ("human approves before money moves", "AI proposes, code decides"). Judges will see that pattern hundreds of times, so **it won't stand out as innovation by itself**. Keep it as a feature, not your pitch.

---

## 7. Winning ideas (scoped for ~30 hours)

What each pick is built to do: stay out of crowded clusters, use 3+ PayPal APIs in depth, show a full loop in 2:30, and lock in one low-competition sponsor prize.

### #1 (recommended) Shopfront MCP: "Make any small PayPal shop buyable by AI agents"
- **Problem:** AI assistants are becoming the place people shop. A small merchant (a bakery, an Etsy-style maker) has no way to show up there. Almost every other entry builds the *buyer's* agent. This builds the **seller's side**, which only one other project touches.
- **Build:**
  1. Merchant onboarding: upload product photos or a CSV. **AI writes agent-readable listings** (attributes, sizes, allergens, policies) and creates them with **PayPal Catalog Products**.
  2. Auto-generated **remote MCP server** per shop: `search_products`, `quote` (shipping and tax), `create_order` (PayPal **Orders v2**, returns the approval link), `track_order` (**Shipment Tracking**).
  3. **Webhooks** (`CHECKOUT.ORDER.APPROVED` → capture) feed a merchant dashboard of "orders placed by AI agents". An AI summary explains which questions agents asked that the listings couldn't answer, and suggests listing fixes.
- **Demo moment:** in Claude Desktop, "Order a dozen gluten-free cupcakes for Saturday under $40". Claude finds the shop's MCP, asks a clarifying question, and returns a PayPal sandbox approval link. You pay, the merchant dashboard lights up, and tracking is added.
- **Targets:** Best Use of Agentic Commerce, grand prizes, plus **Render** (host the MCP servers) or **APIMatic** (use the Context Plugin while building) as the sponsor safety net.
- **Risk:** "Counter" is similar. Stand apart with the merchant-onboarding AI and the "questions agents asked" feedback loop.

### #2 Keep: AI cancellation-save agent for creators on PayPal Subscriptions
- **Problem:** creators and small SaaS on PayPal Subscriptions lose subscribers with one click and never learn why. Tools like Churnkey cost $250+/month and don't support PayPal.
- **Build:** subscriber clicks "cancel" and gets a 30-second chat with an AI that finds the real reason. It then executes the right save **through PayPal**: pause or skip a cycle (`update_subscription` / suspend), downgrade plan, or a one-off discount via an invoice with an **early-pay conditional rule**. If they still leave, it cancels cleanly and records the reason. Creator dashboard shows saves, revenue kept and reason clusters (AI-summarized).
- **Demo moment:** one subscriber cancels for "too expensive", gets a downgrade, and the subscription changes live in sandbox. Then the creator dashboard shows "$1,240 MRR saved this month".
- **Targets:** Most Impactful, PayPal + AI, plus **Bryntum** (a Scheduler timeline per subscriber: billing periods, pauses, saves) or AG Grid.
- **Why it wins:** nearly empty niche, an obvious business case (impact), and deep Subscriptions API use (tech).

### #3 Supply List: teacher posts a photo, parents pay in one tap
- **Problem:** every school term, teachers send messy supply lists and parents shop 15 items across 4 stores. Low-income families miss out.
- **Build:** teacher photographs the list. **AI parses** it, and **Channel3** finds matched, in-stock products per line item with a cheapest total. Parents get one link and pay through PayPal (**Orders**). An optional "sponsor a kit" pools donations so other parents or locals can fund kits for families in need (**Payouts** or a separate order).
- **Targets:** **Channel3 ($1.5k, ~12 competitors, the best sponsor odds)**, Most Impactful, Most Creative.
- **Note:** use made-up brand names in the video, or blur them (trademark rule).

### #4 Lease-to-ledger: AI turns a lease or tutoring contract into PayPal recurring billing
- **Problem:** small landlords and tutors bill by hand every month.
- **Build:** upload a PDF lease or lesson agreement. AI extracts amount, cadence, late fees and early-pay discounts, then creates a **recurring invoice series** plus **conditional rules** (newest toolkit tools, ~0 other users). A **Bryntum Calendar** shows billing dates and payment status. Each month the agent reconciles payments via `list_transactions`.
- **Targets:** Best Use of PayPal + AI (shows off the newest toolkit tools), Bryntum.
- **Caveat:** close to the crowded invoicing cluster. Pitch it as "contract → billing autopilot", not "invoice chaser".

### #5 Agent-readiness audit for PayPal merchants (dev tool)
- Paste a store URL. A **KERNEL** browser agent tries to buy something end to end. AI scores how agent-friendly the checkout is, then generates the fix: a PayPal Payment Link or Orders integration snippet. Builds on the "Last Button" signal that PayPal may retire legacy buttons after Jan 1, 2027 (unconfirmed, seen in one entry).
- Lower impact for consumers; strong with the DevRel judges.

---

## 8. How to beat the other 1,300+

1. **Video first.** Write the 2:30 script *before* coding. Structure:
   - 0:00–0:20: problem and a named persona
   - 0:20–2:00: live end-to-end demo with the PayPal sandbox approval and the capture visible
   - 2:00–2:20: architecture slide naming the PayPal APIs and the AI model
   - 2:20–2:30: impact number

   An AI voiceover is allowed. Cut loading screens. Upload to YouTube **early** (processing takes hours).
2. **Make PayPal and AI impossible to miss:** name the exact APIs in the description, the Built-With tags and the video.
3. **Hosted demo URL** (Render) with sandbox buyer credentials in the testing notes.
4. **Depth beats breadth:** 3–4 PayPal APIs used properly (Orders + Webhooks + Subscriptions/Catalog/Shipment) beats 10 shallow ones.
5. **Pick one sponsor prize on purpose** and tick it on the form.
6. **Submit a draft now**, then edit until the deadline.
7. **README** with: problem, demo GIF, architecture, run steps, `.env.example`, license. AI-assisted judging rewards clarity.
