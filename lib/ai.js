// All Gemini calls live here. Each function has a plain non-AI fallback, used when
// GEMINI_API_KEY is missing or a call fails (including free-tier rate limits), so the product never hard-fails on the AI.
import { keywords } from "./shop.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const API_KEY = process.env.GEMINI_API_KEY;
export const aiEnabled = Boolean(API_KEY);

async function askJson(system, user) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
    signal: AbortSignal.timeout(30_000), // a slow model call must not hang an agent's MCP request
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
  if (start < 0 || end < start) throw new Error("Model returned no JSON.");
  return JSON.parse(text.slice(start, end + 1));
}

async function withFallback(aiCall, fallback) {
  if (!API_KEY) return fallback();
  try {
    return await aiCall();
  } catch (err) {
    console.error("AI call failed, using fallback:", err.message);
    return fallback();
  }
}

// --- 1. Raw merchant notes -> agent-readable listings ---------------------------------------

const LISTING_SYSTEM = `You turn a small merchant's raw product notes into listings an AI shopping agent can reason about.
Return ONLY a JSON array. Each item: {"name": string, "price": number (USD), "description": string (2 factual sentences),
"attributes": object with whatever a buyer's agent would need: allergens[], dietary[], sizes[], servings, leadTimeDays, materials, etc.}
Use only facts present in the notes. Never invent a price; skip items that have no price.`;

export function fallbackListings(rawText) {
  return String(rawText).split("\n").flatMap((line) => {
    // A price is a number after a "$" or after a separator, so prose like "since 1990" is skipped.
    const match = line.match(/^(.+?)\s*(?:[,:|\-–]\s*\$?|\$)\s*(\d+(?:\.\d{1,2})?)\b[\s,:|\-–]*(.*)$/);
    const name = match?.[1].replace(/[\s,:|\-–]+$/, "").trim();
    if (!match || !name) return [];
    return [{ name, price: Number(match[2]), description: match[3].trim(), attributes: {} }];
  });
}

export async function generateListings(rawText) {
  const listings = await withFallback(() => askJson(LISTING_SYSTEM, rawText), () => fallbackListings(rawText));
  return listings
    .filter((l) => l && typeof l.name === "string" && Number.isFinite(Number(l.price)) && Number(l.price) > 0)
    .slice(0, 100)
    .map((l) => ({
      name: l.name.slice(0, 120),
      price: Math.round(Number(l.price) * 100) / 100,
      description: String(l.description ?? "").slice(0),
      attributes: l.attributes && typeof l.attributes === "object" ? l.attributes : {},
    }));
}

// --- 2. Answer an agent's question from what the shop has published --------------------------

const ANSWER_SYSTEM = `You answer questions from AI shopping agents on behalf of a small shop.
Use ONLY the shop data provided. Return ONLY JSON: {"answered": boolean, "answer": string}.
If the data does not cover the question, set answered to false and say the shop hasn't published that. Never guess.`;

function fallbackAnswer(shop, question) {
  const words = keywords(question);
  const sentences = [shop.policies, ...shop.products.map((p) => `${p.name}: ${p.description}`)]
    .join(" ").split(/(?<=[.!?])\s+/);
  const hits = sentences.filter((s) => {
    const lower = s.toLowerCase();
    return words.filter((w) => lower.includes(w)).length >= Math.min(2, words.length) && words.length > 0;
  });
  return hits.length
    ? { answered: true, answer: hits.slice(0, 3).join(" ") }
    : { answered: false, answer: "The shop hasn't published that information." };
}

export async function answerQuestion(shop, question) {
  const data = JSON.stringify({ name: shop.name, policies: shop.policies, products: shop.products });
  const result = await withFallback(
    () => askJson(ANSWER_SYSTEM, `Shop data:\n${data}\n\nQuestion: ${question}`),
    () => fallbackAnswer(shop, question),
  );
  return { answered: Boolean(result.answered), answer: String(result.answer ?? "") };
}

// --- 3. Turn unanswered agent requests into listing fixes ------------------------------------

const GAPS_SYSTEM = `A small shop exposes its catalog to AI shopping agents. Below are agent requests the shop could not satisfy.
Group them into at most 5 gaps. Return ONLY a JSON array of {"want": what buyers wanted (short), "count": number of requests,
"fix": the exact sentence the merchant should add to a listing or policy, or the product they should consider offering}.`;

function fallbackGaps(misses) {
  const groups = new Map();
  for (const m of misses) {
    const key = keywords(m.text).sort().join(" ") || m.text.toLowerCase();
    const group = groups.get(key) ?? { want: m.text, count: 0 };
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 5)
    .map((g) => ({ ...g, fix: `Add a line to your listings or policies that covers "${g.want}".` }));
}

export async function summarizeGaps(shop, misses) {
  if (!misses.length) return [];
  const gaps = await withFallback(
    () => askJson(GAPS_SYSTEM, `Shop: ${shop.name}\nRequests:\n${misses.map((m) => `- ${m.text}`).join("\n")}`),
    () => fallbackGaps(misses),
  );
  return (Array.isArray(gaps) ? gaps : []).slice(0, 5).map((g) => ({
    want: String(g.want ?? ""), count: Number(g.count) || 1, fix: String(g.fix ?? ""),
  }));
}
