import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Observation } from "./observations";
export function observationId(o: Observation) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        o.shoeId,
        o.brand,
        o.article,
        o.color,
        o.edition,
        o.range,
        o.retailer,
        o.variantId,
        o.size,
        o.observedAt,
        o.fixture,
      ]),
    )
    .digest("hex");
}
const showFixtures = () =>
  process.env.NODE_ENV !== "production" &&
  process.env.SHOW_TEST_FIXTURES === "1";
async function sqlite() {
  const { DatabaseSync } = await import("node:sqlite");
  const path = resolve(
    /* turbopackIgnore: true */
    process.env.LACERELAY_DB_PATH || ".data/observations.sqlite",
  );
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS shoe_observations (id TEXT PRIMARY KEY, shoe_id TEXT NOT NULL, payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS observations_shoe ON shoe_observations(shoe_id);",
  );
  return db;
}
function supabase() {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    !parsed.hostname.endsWith(".supabase.co")
  )
    throw new Error("Invalid storage configuration");
  return {
    url: `${parsed.origin}/rest/v1/shoe_observations`,
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  };
}
export function storageStatus() {
  return process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? "supabase"
    : process.env.VERCEL
      ? "unconfigured"
      : "sqlite";
}
export async function saveObservations(rows: Observation[]) {
  if (!rows.length) return;
  if (
    rows.some(
      (o) =>
        !Number.isFinite(Date.parse(o.observedAt)) ||
        !Number.isSafeInteger(o.pricePaise) ||
        o.pricePaise < 0,
    )
  )
    throw new Error("Invalid observation");
  const remote = supabase();
  if (remote) {
    const records = rows.map((o) => ({
      id: observationId(o),
      shoe_id: o.shoeId,
      brand: o.brand,
      article: o.article,
      color: o.color,
      edition: o.edition,
      range: o.range,
      retailer: o.retailer,
      variant_id: o.variantId,
      size_uk: o.size,
      price_paise: o.pricePaise,
      currency: o.currency,
      stock: o.stock,
      observed_at: o.observedAt,
      retrieved_at: o.retrievedAt,
      price_type: o.priceType,
      match_status: o.match,
      url: o.url,
      fixture: o.fixture,
      payload: o,
    }));
    const res = await fetch(`${remote.url}?on_conflict=id`, {
      method: "POST",
      headers: {
        ...remote.headers,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates",
      },
      body: JSON.stringify(records),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error("Observation storage unavailable");
    return;
  }
  if (process.env.VERCEL)
    throw new Error("Persistent storage is not configured");
  const db = await sqlite();
  try {
    db.exec("BEGIN IMMEDIATE");
    const insert = db.prepare(
      "INSERT OR IGNORE INTO shoe_observations(id,shoe_id,payload) VALUES(?,?,?)",
    );
    for (const o of rows)
      insert.run(observationId(o), o.shoeId, JSON.stringify(o));
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  } finally {
    db.close();
  }
}
export async function readObservations(
  shoeId?: string,
): Promise<Observation[]> {
  const remote = supabase();
  let rows: Observation[] = [];
  if (remote) {
    for (let offset = 0; ; offset += 1000) {
      const url = new URL(remote.url);
      url.searchParams.set("select", "payload");
      url.searchParams.set("order", "observed_at.asc,id.asc");
      url.searchParams.set("offset", String(offset));
      url.searchParams.set("limit", "1000");
      if (shoeId) url.searchParams.set("shoe_id", `eq.${shoeId}`);
      if (!showFixtures()) url.searchParams.set("fixture", "eq.false");
      const res = await fetch(url, {
        headers: remote.headers,
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error("Observation storage unavailable");
      const page = (await res.json()) as { payload: Observation }[];
      rows.push(...page.map((p) => p.payload));
      if (page.length < 1000) break;
    }
  } else if (!process.env.VERCEL) {
    const db = await sqlite();
    try {
      const records = shoeId
        ? db
            .prepare("SELECT payload FROM shoe_observations WHERE shoe_id=?")
            .all(shoeId)
        : db.prepare("SELECT payload FROM shoe_observations").all();
      rows = records.map((r) => JSON.parse(String(r.payload)));
    } finally {
      db.close();
    }
  }
  return rows.filter((r) => !r.fixture || showFixtures());
}
