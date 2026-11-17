// Tests for the cloud-save API and the merge rules: node tools/test_sync.mjs
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

process.env.SYNC_SECRET = "test-secret-0123456789abcdef0123456789abcdef";
process.env.FAMILY_KEY = "Test-Family-Key";
process.env.MAX_ACCOUNTS = "3";
process.env.SYNC_DATA_DIR = await mkdtemp(path.join(os.tmpdir(), "rockhound-sync-"));
delete process.env.BLOB_READ_WRITE_TOKEN;

const { default: handler } = await import("../api/sync.js");
const call = (body, method = "POST", ip = "1.1.1.1") => new Promise(resolve => {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(d) { resolve({ status: this.code, data: d }); } };
  handler({ method, body, headers: { "x-forwarded-for": ip } }, res);
});
const state = extra => ({ v: 1, name: "Tester", solved: 0, collected: {}, ...extra });
let n = 0; const ok = (name, fn) => Promise.resolve(fn()).then(() => { n++; console.log("  ✓", name); });

console.log("cloud-save API");
await ok("rejects non-POST", async () => assert.equal((await call({}, "GET")).status, 405));
await ok("create needs the family key", async () => assert.equal((await call({ op: "create", familyKey: "nope", state: state() })).status, 403));
await ok("create rejects a malformed save", async () => assert.equal((await call({ op: "create", familyKey: "test-family-key", state: { v: 2 } })).status, 400));
const made = await call({ op: "create", familyKey: " test-FAMILY-key ", state: state({ solved: 3 }) });
await ok("create returns a readable code", () => { assert.equal(made.status, 200); assert.match(made.data.code, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/); assert.ok(made.data.etag); });
const code = made.data.code;
await ok("pull returns the save", async () => { const r = await call({ op: "pull", code }); assert.equal(r.status, 200); assert.equal(r.data.state.solved, 3); assert.equal(r.data.etag, made.data.etag); });
await ok("pull forgives lowercase, spaces, and O/0 or I/1 mix-ups", async () => {
  const sloppy = code.toLowerCase().replace(/-/g, " ").replace(/0/g, "o").replace(/1/g, "l");
  assert.equal((await call({ op: "pull", code: sloppy })).status, 200);
});
await ok("a made-up code is refused", async () => assert.equal((await call({ op: "pull", code: "ABCD-EFGH-JKMN-PQRS" })).status, 404));
await ok("a code with one wrong character is refused", async () => {
  const bad = (code[0] === "7" ? "8" : "7") + code.slice(1);
  assert.equal((await call({ op: "pull", code: bad })).status, 404);
});
const p1 = await call({ op: "push", code, etag: made.data.etag, state: state({ solved: 6 }) });
await ok("push with the current version succeeds", () => { assert.equal(p1.status, 200); assert.notEqual(p1.data.etag, made.data.etag); });
await ok("push from a device that is behind gets the latest back (409)", async () => {
  const r = await call({ op: "push", code, etag: made.data.etag, state: state({ solved: 4 }) });
  assert.equal(r.status, 409); assert.equal(r.data.state.solved, 6); assert.equal(r.data.etag, p1.data.etag);
});
await ok("a second device can save after loading the save with its code", async () => {
  const loaded = await call({ op: "pull", code });
  const r = await call({ op: "push", code, etag: loaded.data.etag, state: state({ solved: 7 }) });
  assert.equal(r.status, 200); assert.equal((await call({ op: "pull", code })).data.state.solved, 7);
  p1.data.etag = r.data.etag;
});
await ok("a device behind is handed a version it can then save with", async () => {
  const behind = await call({ op: "push", code, etag: made.data.etag, state: state({ solved: 8 }) });
  assert.equal(behind.status, 409);
  const r = await call({ op: "push", code, etag: behind.data.etag, state: state({ solved: 8 }) });
  assert.equal(r.status, 200); p1.data.etag = r.data.etag;
});
await ok("a device still holding a weak version (W/…) from before the fix can save", async () => {
  const r = await call({ op: "push", code, etag: "W/" + p1.data.etag, state: state({ solved: 9 }) });
  assert.equal(r.status, 200); p1.data.etag = r.data.etag;
});
await ok("push without a version is treated as behind", async () => assert.equal((await call({ op: "push", code, state: state() })).status, 409));
await ok("push rejects an oversized save", async () => assert.equal((await call({ op: "push", code, etag: p1.data.etag, state: state({ junk: "x".repeat(200_000) }) })).status, 400));
await ok("the number of cloud saves is capped", async () => {
  for (let i = 0; i < 2; i++) assert.equal((await call({ op: "create", familyKey: "test-family-key", state: state() })).status, 200);
  const r = await call({ op: "create", familyKey: "test-family-key", state: state() });
  assert.equal(r.status, 409); assert.equal(r.data.error, "full");
});
await ok("delete erases the save and the code stops working", async () => {
  assert.equal((await call({ op: "delete", code })).status, 200);
  assert.equal((await call({ op: "pull", code })).status, 404);
  assert.equal((await call({ op: "push", code, etag: p1.data.etag, state: state() })).status, 404);
});
await ok("repeated bad guesses from one address are slowed down", async () => {
  let last; for (let i = 0; i < 25; i++) last = await call({ op: "pull", code: "AAAA-AAAA-AAAA-AAAA" }, "POST", "9.9.9.9");
  assert.equal(last.status, 429);
  assert.equal((await call({ op: "pull", code: "AAAA-AAAA-AAAA-AAAA" }, "POST", "8.8.8.8")).status, 404);
});

console.log("merging two devices");
const mem = {}; globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } };
const G = await import("../js/store.js");
const base = () => G.normalize({ v: 1, name: "Tester" });
await ok("collections are combined and nothing is lost", () => {
  const a = base(), b = base();
  Object.assign(a, { solved: 9, collected: { quartz: 100, pyrite: 300 }, read: { start: 1 }, quiz: { quartz: 1 } });
  Object.assign(b, { solved: 6, collected: { quartz: 90, granite: 200 }, read: { sorting: 1 }, quiz: { quartz: 3, granite: 1 } });
  const m = G.mergeStates(a, b);
  assert.deepEqual(Object.keys(m.collected).sort(), ["granite", "pyrite", "quartz"]);
  assert.equal(m.collected.quartz, 90);
  assert.deepEqual(m.order, ["pyrite", "granite", "quartz"]);
  assert.deepEqual(m.read, { start: 1, sorting: 1 });
  assert.deepEqual(m.quiz, { quartz: 3, granite: 1 });
  assert.equal(m.solved, 9);
});
await ok("math levels follow the device with more problems solved, either way round", () => {
  const a = base(), b = base();
  a.solved = 30; a.math.FR.lvl = 4; b.solved = 12; b.math.FR.lvl = 2;
  assert.equal(G.mergeStates(a, b).math.FR.lvl, 4);
  assert.equal(G.mergeStates(b, a).math.FR.lvl, 4);
});
await ok("a rock in progress is dropped if the other device already found that specimen", () => {
  const a = base(), b = base();
  a.solved = 5; a.box = { target: "topaz", probs: [], i: 1 }; b.solved = 3; b.collected = { topaz: 50 };
  assert.equal(G.mergeStates(a, b).box, null);
});
await ok("a grown-up's newer level change on another device is kept", () => {
  const ipad = base(), phone = base();
  ipad.solved = 24; ipad.math.MD.lvl = 2;                       // the child's device, still playing
  phone.solved = 24; phone.math.MD = { lvl: 1, m: 0, bad: 0, last: "", at: 2000 };   // parent lowered it on a phone
  assert.equal(G.mergeStates(ipad, phone).math.MD.lvl, 1);
  assert.equal(G.mergeStates(phone, ipad).math.MD.lvl, 1);
  ipad.solved = 30; ipad.math.MD = { lvl: 3, m: 0, bad: 0, last: "", at: 5000 };     // later the strand moved again through play
  assert.equal(G.mergeStates(ipad, phone).math.MD.lvl, 3);
});
await ok("newer settings win, older settings do not", () => {
  const a = base(), b = base();
  a.solved = 10; a.set = { limit: 0, sound: true, pace: "gentle", at: 100 };
  b.solved = 2; b.set = { limit: 5, sound: false, pace: "steady", at: 900 };
  assert.equal(G.mergeStates(a, b).set.pace, "steady"); assert.equal(G.mergeStates(a, b).set.limit, 5);
  b.set.at = 50;
  assert.equal(G.mergeStates(a, b).set.pace, "gentle");
});
await ok("combining with an older copy of the same save changes nothing", () => {
  const now = base(); Object.assign(now, { solved: 9, collected: { quartz: 100, pyrite: 300 }, order: ["pyrite", "quartz"], read: { start: 1, sorting: 1 } });
  const earlier = JSON.parse(JSON.stringify(now)); delete earlier.read.sorting; earlier.solved = 8; delete earlier.collected.pyrite; earlier.order = ["quartz"];
  assert.deepEqual(G.mergeStates(now, earlier), G.normalize(now));
});
await ok("merging is safe with an old or empty save", () => { const m = G.mergeStates(base(), { v: 1 }); assert.equal(m.name, "Tester"); assert.ok(m.math.PV); });

await rm(process.env.SYNC_DATA_DIR, { recursive: true, force: true });
console.log(`\n${n} sync checks passed`);
