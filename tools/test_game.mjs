// Simulate whole playthroughs to check the game rules and pacing: node tools/test_game.mjs
import assert from "node:assert/strict";

const mem = {};
globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } };
const G = await import("../js/store.js");
const { TOTAL, STAGES } = await import("../js/data.js");
const { STRAND_IDS } = await import("../js/math.js");

// A pretend calendar so playthroughs can span many days.
let now = new Date("2026-01-01T16:00:00");
G.setClock(() => new Date(now));
const nextDay = () => { now = new Date(now.getTime() + 86_400_000); };
const levels = () => STRAND_IDS.map(s => s + G.S.math[s].lvl).join(" ");
const sumLevels = () => STRAND_IDS.reduce((a, s) => a + G.S.math[s].lvl, 0);

function play(label, { pace, perDay, firstTry, struggle }) {
  G.resetAll();
  G.S.set.pace = pace;
  now = new Date("2026-01-01T16:00:00");
  const strandCount = Object.fromEntries(STRAND_IDS.map(s => [s, 0])), trail = [];
  let boxes = 0, lucky = 0, rankUps = 0, day = 1, maxRiseInADay = 0, risesToday = 0, downs = 0;
  while (G.stageNow() <= STAGES.length) {
    if (boxes && boxes % perDay === 0) { nextDay(); day++; risesToday = 0; }
    const b = G.startBox(0);
    assert.ok(b, "startBox returned null before the end");
    assert.equal(new Set(b.probs.map(p => p.strand)).size, 3, "strands repeated inside one rock");
    assert.ok(!G.has(b.target), "duplicate specimen offered");
    for (const p of b.probs) {
      strandCount[p.strand]++;
      assert.ok(p.level <= G.S.math[p.strand].lvl, "a problem above the strand's level was served");
      const r = Math.random(), tries = r < firstTry ? 1 : r < firstTry + struggle ? 3 : 2;
      const moved = G.recordSolve(p, tries);
      if (moved === "up") { b.ups.push(p.strand); risesToday++; maxRiseInADay = Math.max(maxRiseInADay, risesToday); }
      if (moved === "down") downs++;
      b.i++;
    }
    const last = G.award(); boxes++;
    if (last.lucky) lucky++;
    if (last.rankUp) { rankUps++; trail.push(`day ${String(day).padStart(2)}, rock ${String(boxes).padStart(3)}: ${levels()}`); }
    assert.ok(boxes <= TOTAL, "more rocks than specimens");
  }
  assert.equal(G.countFound(), TOTAL); assert.equal(boxes, TOTAL); assert.equal(rankUps, STAGES.length);
  assert.ok(maxRiseInADay <= G.PACES[pace].perDay, `${maxRiseInADay} strands moved up in one day at ${pace} pace`);
  console.log(`\n${label}\n  ${boxes} rocks over ${day} days (${perDay} a day), ${lucky} lucky finds, ${downs} moves back down, most strands moved up in one day: ${maxRiseInADay}`);
  console.log("  levels at each expedition end:\n   " + trail.join("\n   "));
  return { days: day, total: sumLevels() };
}

console.log("pacing");
// The first session is where it went wrong before: everything must not get harder at once.
G.resetAll();
for (let rock = 0; rock < 12; rock++) { const b = G.startBox(0); for (const p of b.probs) { G.recordSolve(p, 1); b.i++; } G.award(); }
assert.equal(sumLevels(), STRAND_IDS.length + 1, "after a perfect first day exactly one strand should have moved up");
console.log(`  ✓ a perfect first day of 12 rocks moves up exactly one strand: ${levels()}`);
nextDay();
for (let rock = 0; rock < 12; rock++) { const b = G.startBox(0); for (const p of b.probs) { G.recordSolve(p, 1); b.i++; } G.award(); }
assert.equal(sumLevels(), STRAND_IDS.length + 2);
console.log(`  ✓ and one more on the second day: ${levels()}`);

// Trouble moves a strand back down quickly.
G.resetAll(); G.S.math.FR.lvl = 3;
assert.equal(G.recordSolve({ strand: "FR", level: 3, skill: "x" }, 2), null);
assert.equal(G.recordSolve({ strand: "FR", level: 3, skill: "x" }, 3), "down");
assert.equal(G.S.math.FR.lvl, 2);
console.log("  ✓ one two-try problem then one that needed the worked steps moves a strand back down");
G.resetAll(); G.S.math.AS.lvl = 2;
G.recordSolve({ strand: "AS", level: 2, skill: "x" }, 2); G.recordSolve({ strand: "AS", level: 2, skill: "x" }, 1); G.recordSolve({ strand: "AS", level: 2, skill: "x" }, 2);
assert.equal(G.S.math.AS.lvl, 2);
console.log("  ✓ misses with a first-try solve in between do not");

// Saves from the first, too-fast rules are recalibrated when loaded.
const t0 = new Date("2026-01-01T16:00:00").getTime();
const old = { v: 1, name: "Tester", solved: 0, log: [], collected: { quartz: t0 }, math: {}, set: { limit: 0, sound: true } };
for (let round = 0; round < 4; round++) for (const s of STRAND_IDS) { old.log.unshift({ t: t0 + old.solved * 60000, k: "k", s, l: 1, n: 1 }); old.solved++; }
for (const s of STRAND_IDS) old.math[s] = { lvl: 2, m: 0, bad: 0, last: "" };
old.log.unshift({ t: t0 + 30 * 60000, k: "md_t_hard", s: "MD", l: 2, n: 2 }); old.solved++;
old.box = { target: "pyrite", variant: 0, i: 1, tries: 2, miss: 2, h: 2, ok: false, ups: [],
  probs: [{ strand: "PV", level: 2, skill: "pv_digit4" }, { strand: "AS", level: 2, skill: "as_sub22" }, { strand: "MD", level: 1, skill: "md_t_easy" }] };
const fixed = G.normalize(JSON.parse(JSON.stringify(old)));
assert.deepEqual(STRAND_IDS.map(s => fixed.math[s].lvl), [1, 1, 1, 1, 1]);
assert.deepEqual(STRAND_IDS.map(s => fixed.math[s].m), [4, 4, 4, 4, 4]);
assert.equal(fixed.box.probs[0].level, 2, "an already-solved problem is left alone");
assert.equal(fixed.box.probs[1].level, 1); assert.equal(fixed.box.probs[1].strand, "AS"); assert.ok(fixed.box.probs[1].q);
assert.deepEqual([fixed.box.tries, fixed.box.miss, fixed.box.h], [0, 0, 0]);
assert.deepEqual(Object.keys(fixed.collected), ["quartz"]); assert.equal(fixed.rules, 2);
assert.deepEqual(G.normalize(JSON.parse(JSON.stringify(fixed))).math, fixed.math);
console.log("  ✓ an old save that raced to level 2 everywhere is brought back to level 1, and its rock in progress is eased");
const partial = { ...JSON.parse(JSON.stringify(old)), solved: 500 };
assert.deepEqual(STRAND_IDS.map(s => G.normalize(partial).math[s].lvl), [2, 2, 2, 2, 2]);
console.log("  ✓ a save whose history is incomplete keeps its levels");

const gentle = play("Gentle pace, perfect player (every problem right first time), 6 rocks a day", { pace: "gentle", perDay: 6, firstTry: 1, struggle: 0 });
const steady = play("Steady pace, strong player (85% first try), 6 rocks a day", { pace: "steady", perDay: 6, firstTry: 0.85, struggle: 0.03 });
const quick = play("Quick pace, perfect player, 6 rocks a day", { pace: "quick", perDay: 6, firstTry: 1, struggle: 0 });
play("Gentle pace, struggling player (45% first try, 25% need the worked steps), 4 rocks a day", { pace: "gentle", perDay: 4, firstTry: 0.45, struggle: 0.25 });
assert.ok(gentle.total < quick.total, "gentle should climb more slowly than quick");
console.log("\nall playthroughs completed");
