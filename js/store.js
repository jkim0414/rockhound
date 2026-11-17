// Saved state + game rules. Everything lives in localStorage on the device.
import { SPECIMENS, STAGES, FINAL_RANK } from "./data.js";
import { STRAND_IDS, MAX_LEVEL, makeProblem, regenerate } from "./math.js";

const KEY = "rockhound.v1";
const LUCKY_CHANCE = 0.12;          // chance a rock holds a specimen from the next expedition
const REVIEW_CHANCE = 0.25;         // chance a problem is review from an easier level
const SETTLING_REVIEW = 0.5;        // ...and while a new level is still settling in
const RULES = 2;                    // version of the levelling rules a save was last played under

// How quickly the math climbs. Chosen under Grown-ups.
//   goal   = first-try solves needed at a level (each miss takes some away)
//   perDay = how many strands may move up a level on one calendar day
export const PACES = {
  gentle: { name: "Gentle", goal: 8, perDay: 1, about: "One strand may move up a level per day, after 8 first-try solves." },
  steady: { name: "Steady", goal: 6, perDay: 2, about: "Two strands may move up per day, after 6 first-try solves." },
  quick: { name: "Quick", goal: 4, perDay: 99, about: "No daily limit. A strand moves up after 4 first-try solves." },
};

const fresh = () => ({
  v: 1, name: "", pin: "", collected: {}, order: [],
  math: Object.fromEntries(STRAND_IDS.map(s => [s, { lvl: 1, m: 0, bad: 0, last: "" }])),
  stats: {}, log: [], rot: [], box: null, last: null,
  day: { d: "", n: 0 }, ups: { d: "", n: 0 }, set: { limit: 0, sound: true, pace: "gentle" },
  read: {}, quiz: {}, solved: 0, rules: RULES,
});

let clock = () => new Date();       // tests swap this to move through days
export const setClock = fn => { clock = fn; };
const dayOf = date => date.toLocaleDateString("en-CA");
const today = () => dayOf(clock());

// The levelling rule itself, shared by live play and by recalibration.
// First try: +1. Two tries: -1. Needed the worked steps: -2. Misses in a row add up, and
// three points of trouble in a row move the strand back down a level.
function settle(m, tries, { goal, cap, mayRise }) {
  if (tries === 1) { m.m = Math.min(goal, m.m + 1); m.bad = 0; }
  else { const w = tries >= 3 ? 2 : 1; m.m = Math.max(0, m.m - w); m.bad += w; }
  if (m.bad >= 3 && m.lvl > 1) { m.lvl--; m.m = Math.floor(goal / 2); m.bad = 0; return "down"; }
  if (tries === 1 && m.m >= goal && m.lvl < cap && mayRise()) { m.lvl++; m.m = 0; m.bad = 0; return "up"; }
  return null;
}

// One-time fix for saves played under the first, too-fast rules: replay the whole history
// under the current rules to find where each strand should really be. Levels only ever come
// down here. If the history is incomplete, levels are left alone.
function recalibrate(s) {
  const pace = PACES[s.set.pace] || PACES.gentle;
  if (!s.log.length || s.solved > s.log.length) return;
  const sim = Object.fromEntries(STRAND_IDS.map(id => [id, { lvl: 1, m: 0, bad: 0, last: s.math[id].last || "" }]));
  const rises = {};
  for (const e of [...s.log].reverse()) {            // oldest first
    const m = sim[e.s];
    if (!m || e.l !== m.lvl) continue;
    const day = dayOf(new Date(e.t));
    if (settle(m, e.n, { goal: pace.goal, cap: MAX_LEVEL, mayRise: () => (rises[day] || 0) < pace.perDay }) === "up") rises[day] = (rises[day] || 0) + 1;
  }
  for (const id of STRAND_IDS) if (sim[id].lvl < s.math[id].lvl) s.math[id] = sim[id];
  s.ups = { d: today(), n: rises[today()] || 0 };
  const b = s.box;                                   // a rock in progress: swap unsolved problems that are now too hard
  if (b && Array.isArray(b.probs)) b.probs.forEach((p, i) => {
    const solved = i < b.i || (i === b.i && b.ok);
    if (solved || p.level <= s.math[p.strand].lvl) return;
    b.probs[i] = makeProblem(p.strand, s.math[p.strand].lvl, p.skill);
    if (i === b.i) { b.tries = 0; b.miss = 0; b.h = 0; }
  });
}

// Fill in anything missing so older or partial saves still load.
export function normalize(raw) {
  const base = fresh();
  if (!raw || raw.v !== 1) return base;
  const out = { ...base, ...raw, math: { ...base.math, ...raw.math }, set: { ...base.set, ...raw.set }, ups: { ...base.ups, ...raw.ups } };
  if ((raw.rules || 1) < RULES) { recalibrate(out); out.rules = RULES; }
  return out;
}
function load() {
  try { return normalize(JSON.parse(localStorage.getItem(KEY))); } catch { return fresh(); }
}
const write = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage full or blocked */ } };
export let S = load();
write();                                    // keep any recalibration done while loading
let afterSave = null;                       // cloud save listens here
export const setAfterSave = fn => { afterSave = fn; };
export const save = () => { write(); if (afterSave) afterSave(); };
export const resetAll = () => { const keep = { name: S.name, pin: S.pin, set: S.set }; S = { ...fresh(), ...keep }; save(); };
// Replace everything with a state that came from the cloud (does not count as a local change).
export const adopt = state => { S = normalize(state); write(); };
export const wipe = () => { S = fresh(); write(); };
export const hasProgress = () => S.solved > 0 || Object.keys(S.collected).length > 0;

// Combine two copies of the same explorer that changed on different devices.
// Nothing found is ever lost: collections, finished chapters and stars are combined.
// Math levels and settings come from the copy with more problems solved, unless the other
// copy holds a more recent level change or settings change.
export function mergeStates(x, y) {
  x = normalize(x); y = normalize(y);
  const [base, other] = y.solved > x.solved ? [y, x] : [x, y];
  const out = JSON.parse(JSON.stringify(base));
  for (const [id, t] of Object.entries(other.collected)) out.collected[id] = Math.min(out.collected[id] || Infinity, t);
  out.order = Object.keys(out.collected).sort((p, q) => out.collected[q] - out.collected[p]);
  for (const k of Object.keys(other.read)) out.read[k] = 1;
  for (const [id, n] of Object.entries(other.quiz)) out.quiz[id] = Math.max(out.quiz[id] || 0, n);
  for (const [k, v] of Object.entries(other.stats)) if (!out.stats[k] || v.a > out.stats[k].a) out.stats[k] = v;
  const seen = new Set(out.log.map(l => l.t + l.k));
  out.log = out.log.concat(other.log.filter(l => !seen.has(l.t + l.k))).sort((p, q) => q.t - p.t).slice(0, 80);
  // A level placed more recently (by a grown-up or by play) and newer settings win, whichever device they came from.
  for (const id of STRAND_IDS) if ((other.math[id].at || 0) > (out.math[id].at || 0)) out.math[id] = { ...other.math[id] };
  if ((other.set.at || 0) > (out.set.at || 0)) { out.set = { ...other.set }; out.name = other.name || out.name; }
  if (out.box && out.collected[out.box.target]) out.box = null;
  out.day = x.day.d === y.day.d ? { d: x.day.d, n: Math.max(x.day.n, y.day.n) } : (x.day.d > y.day.d ? x.day : y.day);
  out.name = base.name || other.name; out.pin = base.pin || other.pin;
  return out;
}

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = ri(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const has = id => !!S.collected[id];
export const countFound = () => Object.keys(S.collected).length;
export const missingIn = st => SPECIMENS.filter(s => s.st === st && !has(s.id));
export const foundIn = st => SPECIMENS.filter(s => s.st === st && has(s.id)).length;
export const sizeOf = st => SPECIMENS.filter(s => s.st === st).length;
// The current expedition is the first one with something still to find (11 = all done).
export function stageNow() { for (const st of STAGES) if (missingIn(st.n).length) return st.n; return STAGES.length + 1; }
export const rankName = () => { const st = stageNow(); return st > STAGES.length ? FINAL_RANK : STAGES[st - 1].rank; };
export const levelCap = () => Math.min(MAX_LEVEL, stageNow() + 2);
export const pace = () => PACES[S.set.pace] || PACES.gentle;
export const masteryGoal = () => pace().goal;
export function risesToday() { if (S.ups.d !== today()) S.ups = { d: today(), n: 0 }; return S.ups.n; }

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
    const settling = m.m < masteryGoal() * 0.4;      // a level he only just reached: mix in more of what he knows
    if (lvl > 1 && Math.random() < (settling ? SETTLING_REVIEW : REVIEW_CHANCE)) lvl -= ri(1, Math.min(2, lvl - 1));
    const p = makeProblem(sid, lvl, m.last);
    m.last = p.skill;
    return p;
  });
  S.box = { target: pick(pool).id, lucky, variant, probs, i: 0, tries: 0, miss: 0, h: 0, ok: false, ups: [] };
  save();
  return S.box;
}

export function swapProblem() { const b = S.box; b.probs[b.i] = regenerate(b.probs[b.i]); b.h = 0; b.miss = 0; save(); }

// Record a solved problem. Only problems at the strand's current level move mastery.
// Returns "up" / "down" when the strand's level changes. A strand moves up slowly and on
// purpose: plenty of first-try solves, and only so many strands per day (see PACES).
export function recordSolve(p, tries) {
  const st = S.stats[p.skill] || (S.stats[p.skill] = { a: 0, f: 0, t: 0 });
  st.a++; st.t += tries; if (tries === 1) st.f++;
  S.log.unshift({ t: clock().getTime(), k: p.skill, s: p.strand, l: p.level, n: tries });
  S.log.length = Math.min(S.log.length, 80);
  S.solved++;
  const m = S.math[p.strand];
  if (p.level !== m.lvl) return null;
  const moved = settle(m, tries, { goal: masteryGoal(), cap: levelCap(), mayRise: () => risesToday() < pace().perDay });
  if (moved === "up") S.ups.n++;
  if (moved) m.at = clock().getTime();
  return moved;
}

export function award() {
  const b = S.box, before = stageNow();
  S.collected[b.target] = clock().getTime();
  S.order.unshift(b.target);
  boxesToday(); S.day.n++;
  const after = stageNow();
  S.last = { id: b.target, lucky: b.lucky, ups: b.ups, rankUp: after > before ? after : 0 };
  S.box = null;
  save();
  return S.last;
}
