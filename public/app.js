// Tiny helpers shared by all three pages.

// el("div", { class: "row" }, "text", childNode) -> element. Text is always set as text, never HTML.
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.append(...children.filter((c) => c !== null && c !== undefined));
  return node;
}

export const money = (n) => `$${Number(n).toFixed(2)}`;

export async function api(path, body) {
  const res = await fetch(path, body === undefined ? undefined : {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
