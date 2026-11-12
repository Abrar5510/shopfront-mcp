import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCart, searchProducts, slugify, verifyCapture } from "../lib/shop.js";
import { fallbackListings } from "../lib/ai.js";

const seed = JSON.parse(readFileSync(new URL("../seed.json", import.meta.url), "utf8"));
const shop = seed.shops["sweet-crumb-bakery"];

const paidOrder = (value, status = "COMPLETED") => ({
  id: "ORDER1",
  status,
  payer: { name: { given_name: "Ada", surname: "Buyer" }, email_address: "ada@example.com" },
  purchase_units: [{ payments: { captures: [{ id: "CAP1", amount: { currency_code: "USD", value } }] } }],
});

test("slugify", () => {
  assert.equal(slugify("  Sweet Crumb Bakery! "), "sweet-crumb-bakery");
});

test("search matches across name, description and attributes", () => {
  assert.deepEqual(searchProducts(shop, "gluten-free cupcakes").map((p) => p.id), ["p1"]);
  assert.deepEqual(searchProducts(shop, "vegan").map((p) => p.id), ["p3", "p5"]);
  assert.equal(searchProducts(shop, "sushi").length, 0);
  assert.equal(searchProducts(shop, "").length, shop.products.length);
});

test("cart total comes from shop prices and avoids float drift", () => {
  const cart = buildCart(shop, [{ id: "p1", qty: 1 }, { id: "p3", qty: 3 }]);
  assert.equal(cart.total, 63);
  const cents = buildCart({ products: [{ id: "x", name: "x", price: 0.1 }] }, [{ id: "x", qty: 3 }]);
  assert.equal(cents.total, 0.3);
});

test("cart rejects bad input", () => {
  assert.throws(() => buildCart(shop, []), /at least one/);
  assert.throws(() => buildCart(shop, [{ id: "nope", qty: 1 }]), /Unknown product/);
  assert.throws(() => buildCart(shop, [{ id: "p1", qty: 0 }]), /Quantity/);
  assert.throws(() => buildCart(shop, [{ id: "p1", qty: 1.5 }]), /Quantity/);
});

test("capture is accepted only when completed, unpaid and the amount matches", () => {
  const cart = { status: "pending", total: 36 };
  assert.deepEqual(verifyCapture(cart, paidOrder("36.00")), {
    paypalOrderId: "ORDER1", captureId: "CAP1", payer: { name: "Ada Buyer", email: "ada@example.com" },
  });
  assert.match(verifyCapture(cart, paidOrder("1.00")).error, /does not match/);
  assert.match(verifyCapture(cart, paidOrder("36.00", "APPROVED")).error, /not completed/);
  assert.match(verifyCapture({ status: "paid", total: 36 }, paidOrder("36.00")).error, /already paid/);
  assert.match(verifyCapture(undefined, paidOrder("36.00")).error, /No such cart/);
});

test("fallback listing parser reads name, price and description, skips unpriced lines", () => {
  const out = fallbackListings("Banana bread - $8.50 - moist, no nuts\nOur story since 1990\nBagels: 7");
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { name: "Banana bread", price: 8.5, description: "moist, no nuts", attributes: {} });
});
