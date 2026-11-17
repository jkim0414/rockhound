// Cloud save API. One endpoint, four operations, all POST with a JSON body:
//   { op: "create", familyKey, state }  -> { code, etag }      start a cloud save
//   { op: "pull",   code }              -> { state, etag }     load it on a device
//   { op: "push",   code, state, etag } -> { etag }            save (409 + latest if someone else saved first)
//   { op: "delete", code }              -> { ok }              erase the cloud copy
// The save itself is the game's own progress object. No email, no password, no tracking.
import { familyKeyOk, isValid, newCode, normalize, pretty, uid } from "./_lib/codes.js";
import * as store from "./_lib/store.js";

const MAX_BYTES = 150_000;
const maxAccounts = () => Number(process.env.MAX_ACCOUNTS || 12);
const keyOf = code => `u/${uid(code)}/state.json`;

// Best-effort brake on guessing (per server instance). Real protection is the code length.
const strikes = new Map();
function tooMany(ip) {
  const now = Date.now(), rec = strikes.get(ip);
  return !!rec && rec.until > now && rec.n >= 20;
}
function strike(ip) {
  const now = Date.now(), rec = strikes.get(ip);
  if (!rec || rec.until < now) strikes.set(ip, { n: 1, until: now + 10 * 60_000 }); else rec.n++;
  if (strikes.size > 5000) strikes.clear();
}

function cleanState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state) || state.v !== 1) return null;
  const text = JSON.stringify(state);
  return text.length > MAX_BYTES ? null : state;
}
const pack = state => JSON.stringify({ v: 1, savedAt: new Date().toISOString(), state });

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== "object") return res.status(400).json({ error: "body" });
  const ip = String(req.headers["x-forwarded-for"] || "local").split(",")[0].trim();
  if (tooMany(ip)) return res.status(429).json({ error: "slow" });

  try {
    if (body.op === "create") {
      if (!familyKeyOk(body.familyKey)) { strike(ip); return res.status(403).json({ error: "key" }); }
      const state = cleanState(body.state);
      if (!state) return res.status(400).json({ error: "state" });
      if (await store.countFolders("u/") >= maxAccounts()) return res.status(409).json({ error: "full" });
      const code = newCode();
      const { etag } = await store.write(keyOf(code), pack(state), { create: true });
      return res.status(200).json({ code: pretty(code), etag });
    }

    const code = normalize(body.code);
    if (!isValid(code)) { strike(ip); return res.status(404).json({ error: "code" }); }
    const key = keyOf(code);

    if (body.op === "pull") {
      const rec = await store.read(key);
      if (!rec) return res.status(404).json({ error: "code" });
      const saved = JSON.parse(rec.text);
      return res.status(200).json({ code: pretty(code), state: saved.state, etag: rec.etag, savedAt: saved.savedAt });
    }
    if (body.op === "push") {
      const state = cleanState(body.state);
      if (!state) return res.status(400).json({ error: "state" });
      try {
        if (!body.etag) throw new store.Conflict();
        const { etag } = await store.write(key, pack(state), { ifMatch: String(body.etag) });
        return res.status(200).json({ etag });
      } catch (e) {
        if (!(e instanceof store.Conflict)) throw e;
        const rec = await store.read(key); // someone else saved first: hand back the latest
        if (!rec) return res.status(404).json({ error: "code" });
        return res.status(409).json({ state: JSON.parse(rec.text).state, etag: rec.etag });
      }
    }
    if (body.op === "delete") {
      await store.remove(key);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "op" });
  } catch (e) {
    console.error("sync error:", e && e.message);
    return res.status(e && e.status === 503 ? 503 : 500).json({ error: e && e.status === 503 ? "setup" : "server" });
  }
}
