// Cloud save: keeps one explorer's progress in step across devices.
// The game always works from the copy on this device; this module quietly sends
// changes up and brings newer changes down when there is an internet connection.
import * as G from "./store.js";

const KEY = "rockhound.sync";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const info = load();                 // { code, etag, dirty, savedAt }
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(info)); } catch { /* ignore */ } };

let status = info.code ? (info.dirty ? "pending" : "saved") : "off";   // off | saved | pending | saving | gone
let onChange = () => {}, onAdopt = () => {};
let version = 0, busy = false, timer = null, lastPull = 0;

export const isOn = () => !!info.code;
export const getStatus = () => status;
export const getCode = () => info.code || "";
export const savedAt = () => info.savedAt || 0;
export function listen(changeFn, adoptFn) { onChange = changeFn; onAdopt = adoptFn; }
function setStatus(s) { if (status !== s) { status = s; onChange(); } }

async function call(body, keepalive = false) {
  try {
    const r = await fetch("api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive });
    let data = {};
    try { data = await r.json(); } catch { /* not JSON */ }
    return { status: r.status, data };
  } catch { return { status: 0, data: {} }; }   // offline
}

// Compare two saves regardless of key order.
const stable = v => JSON.stringify(v, (k, x) => x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map(key => [key, x[key]])) : x);
// Fold a cloud copy into this device. Returns true only if something here actually changed.
// (Often nothing does: the "newer" cloud copy is just this device's own earlier save whose
// reply was lost when the app went into the background.)
function absorb(remote, merge) {
  const before = stable(G.S);
  const next = merge ? G.mergeStates(G.S, remote) : G.normalize(remote);
  if (stable(next) === before) return false;
  G.adopt(next);
  return true;
}

// Every local save lands here.
function touched() {
  if (!isOn()) return;
  version++;
  if (!info.dirty) { info.dirty = true; persist(); }
  if (status !== "saving" && status !== "gone") setStatus("pending");
}
G.setAfterSave(touched);

// Send soon. Called at natural stopping points (a rock opened, a chapter finished…).
export function checkpoint(delay = 1500) {
  if (!isOn()) return;
  clearTimeout(timer);
  timer = setTimeout(() => push(), delay);
}

export async function push({ keepalive = false, retry = true } = {}) {
  if (!isOn() || !info.dirty || busy || status === "gone") return status === "saved";
  busy = true; setStatus("saving");
  const sent = version;
  const r = await call({ op: "push", code: info.code, etag: info.etag, state: G.S }, keepalive);
  busy = false;
  if (r.status === 200) {
    info.etag = r.data.etag; info.savedAt = Date.now(); info.dirty = version !== sent; persist();
    setStatus(info.dirty ? "pending" : "saved");
    return !info.dirty;
  }
  if (r.status === 409 && r.data.state) {       // the cloud copy is ahead of what this device last saw: combine, then send again
    const changed = absorb(r.data.state, true);
    info.etag = r.data.etag; info.dirty = true; persist();
    if (changed) onAdopt();
    return retry ? push({ retry: false }) : false;
  }
  if (r.status === 404) { setStatus("gone"); return false; }   // the cloud save was deleted
  setStatus("pending");                                           // offline or server trouble: try again later
  return false;
}

// Bring down anything newer. Throttled so switching apps does not hammer the server.
export async function pull(force = false) {
  if (!isOn() || busy || status === "gone") return;
  if (!force && Date.now() - lastPull < 30_000) return;
  lastPull = Date.now();
  const r = await call({ op: "pull", code: info.code });
  if (r.status === 404) return setStatus("gone");
  if (r.status !== 200) return;
  if (r.data.etag === info.etag) { if (info.dirty) push(); return; }
  if (info.dirty) { const changed = absorb(r.data.state, true); info.etag = r.data.etag; persist(); if (changed) onAdopt(); return push(); }
  const changed = absorb(r.data.state, false);
  info.etag = r.data.etag; info.savedAt = Date.now(); persist();
  setStatus("saved");
  if (changed) onAdopt();
}

// Start a cloud save from what is on this device. Returns "" on success or an error word.
export async function create(familyKey) {
  const r = await call({ op: "create", familyKey, state: G.S });
  if (r.status !== 200) return r.data.error || (r.status ? "server" : "offline");
  Object.assign(info, { code: r.data.code, etag: r.data.etag, dirty: false, savedAt: Date.now() }); persist();
  setStatus("saved");
  return "";
}

const tidy = code => (String(code).toUpperCase().replace(/[^0-9A-Z]/g, "").match(/.{1,4}/g) || []).join("-");

// Use an existing cloud save on this device. Anything already found here is combined in.
export async function join(code) {
  code = tidy(code);
  const r = await call({ op: "pull", code });
  if (r.status !== 200) return r.data.error || (r.status ? "server" : "offline");
  const mine = G.hasProgress();
  G.adopt(mine ? G.mergeStates(G.S, r.data.state) : r.data.state);
  Object.assign(info, { code: r.data.code || code, etag: r.data.etag, dirty: mine, savedAt: Date.now() }); persist();
  status = mine ? "pending" : "saved"; onChange();
  if (mine) push();
  return "";
}

// Leave this device. Tries to save first; returns false if unsaved changes could not be sent.
export async function signOut(force = false) {
  if (isOn() && info.dirty && status !== "gone") { const ok = await push(); if (!ok && !force) return false; }
  forget();
  G.wipe();
  return true;
}
// Erase the cloud copy. Progress on this device stays.
export async function removeCloud() {
  const r = await call({ op: "delete", code: info.code });
  if (r.status !== 200) return false;
  forget();
  return true;
}
export const forgetLocal = () => forget();
function forget() {
  for (const k of Object.keys(info)) delete info[k];
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  status = "off"; onChange();
}

export function start() {
  document.addEventListener("visibilitychange", () => { if (document.hidden) push({ keepalive: true }); else pull(); });
  window.addEventListener("pagehide", () => push({ keepalive: true }));
  window.addEventListener("online", () => { if (info.dirty) push(); else pull(); });
  setInterval(() => { if (info.dirty && !document.hidden) push(); }, 300_000);   // safety net during long sessions
  if (isOn()) pull(true);
}
