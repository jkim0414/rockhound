// Saved state + game rules. Everything lives in localStorage on the device.
import { SPECIMENS, STAGES, FINAL_RANK } from "./data.js";
import { STRAND_IDS, MAX_LEVEL, makeProblem, regenerate } from "./math.js";

const KEY = "rockhound.v1";
export const MASTERY_GOAL = 4;      // first-try solves at a level before moving up
const LUCKY_CHANCE = 0.12;          // chance a rock holds a specimen from the next expedition
const REVIEW_CHANCE = 0.25;         // chance a problem is review from an easier level

const fresh = () => ({
  v: 1, name: "", pin: "", collected: {}, order: [],
  math: Object.fromEntries(STRAND_IDS.map(s => [s, { lvl: 1, m: 0, bad: 0, last: "" }])),
  stats: {}, log: [], rot: [], box: null, last: null,
  day: { d: "", n: 0 }, set: { limit: 0, sound: true },
  read: {}, quiz: {}, solved: 0,
});

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && raw.v === 1) {
      const base = fresh();
      return { ...base, ...raw, math: { ...base.math, ...raw.math }, set: { ...base.set, ...raw.set } };
    }
  } catch { /* fall through to a fresh game */ }
  return fresh();
}
export let S = load();
export const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage full or blocked */ } };
export const resetAll = () => { const keep = { name: S.name, pin: S.pin, set: S.set }; S = { ...fresh(), ...keep }; save(); };

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = ri(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const today = () => new Date().toLocaleDateString("en-CA");

export const has = id => !!S.collected[id];
export const countFound = () => Object.keys(S.collected).length;
export const missingIn = st => SPECIMENS.filter(s => s.st === st && !has(s.id));
export const foundIn = st => SPECIMENS.filter(s => s.st === st && has(s.id)).length;
export const sizeOf = st => SPECIMENS.filter(s => s.st === st).length;
// The current expedition is the first one with something still to find (11 = all done).
export function stageNow() { for (const st of STAGES) if (missingIn(st.n).length) return st.n; return STAGES.length + 1; }
export const rankName = () => { const st = stageNow(); return st > STAGES.length ? FINAL_RANK : STAGES[st - 1].rank; };
export const levelCap = () => Math.min(MAX_LEVEL, stageNow() + 2);

export function boxesToday() { if (S.day.d !== today()) S.day = { d: today(), n: 0 }; return S.day.n; }
export const canDig = () => !S.set.limit || boxesToday() < S.set.limit;

function takeStrands(n) {
  const out = [];
  while (out.length < n) {
    if (!S.rot.length) S.rot = shuffle(STRAND_IDS);
    const i = S.rot.findIndex(s => !out.includes(s));
    if (i < 0) { S.rot = S.rot.concat(shuffle(STRAND_IDS)); continue; }
    out.push(S.rot.splice(i, 1)[0]);
  }
  return out;
}

export function startBox(variant) {
  const st = stageNow();
  if (st > STAGES.length) return null;
  let pool = missingIn(st), lucky = false;
  const next = missingIn(st + 1);
  if (next.length && foundIn(st) >= 3 && Math.random() < LUCKY_CHANCE) { pool = next; lucky = true; }
  const probs = takeStrands(3).map(sid => {
    const m = S.math[sid];
    let lvl = m.lvl;
    if (lvl > 1 && Math.random() < REVIEW_CHANCE) lvl -= ri(1, Math.min(2, lvl - 1));
    const p = makeProblem(sid, lvl, m.last);
    m.last = p.skill;
    return p;
  });
  S.box = { target: pick(pool).id, lucky, variant, probs, i: 0, tries: 0, miss: 0, h: 0, ups: [] };
  save();
  return S.box;
}

export function swapProblem() { const b = S.box; b.probs[b.i] = regenerate(b.probs[b.i]); b.h = 0; b.miss = 0; save(); }

// Record a solved problem. Only problems at the strand's current level move mastery.
// Returns "up" / "down" when the strand's level changes.
export function recordSolve(p, tries) {
  const st = S.stats[p.skill] || (S.stats[p.skill] = { a: 0, f: 0, t: 0 });
  st.a++; st.t += tries; if (tries === 1) st.f++;
  S.log.unshift({ t: Date.now(), k: p.skill, s: p.strand, l: p.level, n: tries });
  S.log.length = Math.min(S.log.length, 80);
  S.solved++;
  const m = S.math[p.strand];
  if (p.level !== m.lvl) return null;
  if (tries === 1) { m.m++; m.bad = 0; }
  else if (tries >= 3) { m.m = Math.max(0, m.m - 1); m.bad++; }
  if (m.m >= MASTERY_GOAL && m.lvl < levelCap()) { m.lvl++; m.m = 0; m.bad = 0; return "up"; }
  if (m.bad >= 2 && m.lvl > 1) { m.lvl--; m.m = 2; m.bad = 0; return "down"; }
  m.m = Math.min(m.m, MASTERY_GOAL);
  return null;
}

export function award() {
  const b = S.box, before = stageNow();
  S.collected[b.target] = Date.now();
  S.order.unshift(b.target);
  boxesToday(); S.day.n++;
  const after = stageNow();
  S.last = { id: b.target, lucky: b.lucky, ups: b.ups, rankUp: after > before ? after : 0 };
  S.box = null;
  save();
  return S.last;
}
