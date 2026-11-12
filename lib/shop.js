// Pure shop logic: no I/O, no network. Everything here is unit-tested in test/shop.test.js.

const toCents = (usd) => Math.round(Number(usd) * 100);
export const fromCents = (cents) => cents / 100;

export function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

const STOPWORDS = new Set(["a", "an", "the", "for", "of", "and", "or", "with", "some", "any", "me", "i", "to", "in", "under", "do", "you", "have"]);

// ponytail: substring keyword match with naive plural stripping. Swap for embeddings if catalogs outgrow ~200 items.
export function keywords(text) {
  return String(text).toLowerCase().split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map((w) => (w.length > 3 ? w.replace(/(es|s)$/, "") : w));
}

export function searchProducts(shop, query) {
  const words = keywords(query);
  if (!words.length) return shop.products;
  return shop.products.filter((p) => {
    const haystack = JSON.stringify([p.name, p.description, p.attributes]).toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}

// Builds a cart from agent-supplied {id, qty} pairs. Prices always come from the shop, never the caller.
export function buildCart(shop, items) {
  if (!Array.isArray(items) || !items.length) throw new Error("Cart needs at least one item.");
  let totalCents = 0;
  const lines = items.map(({ id, qty }) => {
    const product = shop.products.find((p) => p.id === id);
    if (!product) throw new Error(`Unknown product id "${id}". Use search_products to find valid ids.`);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) throw new Error(`Quantity for "${id}" must be a whole number from 1 to 99.`);
    totalCents += toCents(product.price) * qty;
    return { id, name: product.name, price: product.price, qty };
  });
  return { items: lines, total: fromCents(totalCents) };
}

// Checks a captured PayPal order (as returned by the JS SDK) against our cart.
// Returns { error } or { paypalOrderId, captureId, payer }.
export function verifyCapture(cart, order) {
  if (!cart) return { error: "No such cart." };
  if (cart.status !== "pending") return { error: "This cart was already paid." };
  if (order?.status !== "COMPLETED") return { error: "PayPal order is not completed." };
  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  const amount = capture?.amount ?? unit?.amount;
  if (amount?.currency_code !== "USD" || toCents(amount.value) !== toCents(cart.total)) {
    return { error: "Captured amount does not match the cart total." };
  }
  const name = [order.payer?.name?.given_name, order.payer?.name?.surname].filter(Boolean).join(" ");
  return {
    paypalOrderId: String(order.id),
    captureId: capture?.id ?? null,
    payer: { name: name || "PayPal buyer", email: order.payer?.email_address ?? null },
  };
}
