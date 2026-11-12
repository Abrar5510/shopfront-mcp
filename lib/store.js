// Storage: one JSON file, read and written whole.
// ponytail: no locking. Fine for a single-process demo; move to SQLite when concurrent writes matter.
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const DATA_FILE = process.env.DATA_FILE || new URL("../data.json", import.meta.url).pathname;
const SEED_FILE = new URL("../seed.json", import.meta.url).pathname;

export function load() {
  const file = existsSync(DATA_FILE) ? DATA_FILE : SEED_FILE;
  const db = JSON.parse(readFileSync(file, "utf8"));
  return { shops: {}, carts: {}, events: [], ...db };
}

export function save(db) {
  const tmp = `${DATA_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, DATA_FILE); // atomic: a crash mid-write never leaves a half-written file
}

export const newId = (prefix) => `${prefix}_${randomBytes(6).toString("hex")}`;

const MAX_EVENTS = 2000;

export function logEvent(shop, event) {
  const db = load();
  db.events.push({ shop, at: new Date().toISOString(), ...event });
  if (db.events.length > MAX_EVENTS) db.events.splice(0, db.events.length - MAX_EVENTS);
  save(db);
}
