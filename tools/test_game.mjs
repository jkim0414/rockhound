// Simulate whole playthroughs to check the game rules: node tools/test_game.mjs
const mem = {};
globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
const G = await import("../js/store.js");
const { TOTAL, STAGES } = await import("../js/data.js");
const { STRAND_IDS } = await import("../js/math.js");

function play(label, firstTry, struggle) {
  G.resetAll();
  const trail = [], strandCount = Object.fromEntries(STRAND_IDS.map(s => [s, 0]));
  let boxes = 0, lucky = 0, rankUps = 0;
  while (G.stageNow() <= STAGES.length) {
    const b = G.startBox(0);
    if (!b) throw new Error("startBox returned null before the end");
    if (new Set(b.probs.map(p => p.strand)).size !== 3) throw new Error("strands repeated inside one box");
    if (G.has(b.target)) throw new Error("duplicate specimen offered");
    for (const p of b.probs) {
      strandCount[p.strand]++;
      const r = Math.random(), tries = r < firstTry ? 1 : r < firstTry + struggle ? 3 : 2;
      if (G.recordSolve(p, tries) === "up") b.ups.push(p.strand);
      b.i++;
    }
    const last = G.award(); boxes++;
    if (last.lucky) lucky++;
    if (last.rankUp) { rankUps++; trail.push(`after box ${boxes}: ${STRAND_IDS.map(s => s + G.S.math[s].lvl).join(" ")}`); }
    if (boxes > TOTAL) throw new Error("more boxes than specimens");
  }
  if (G.countFound() !== TOTAL || boxes !== TOTAL) throw new Error("collection did not complete exactly");
  if (rankUps !== STAGES.length) throw new Error("expected one rank-up per expedition, got " + rankUps);
  console.log(`\n${label}: ${boxes} boxes, ${boxes * 3} problems, ${lucky} lucky finds, rank ${G.rankName()}`);
  console.log("  problems per strand:", JSON.stringify(strandCount));
  console.log("  levels at each expedition end:\n   " + trail.join("\n   "));
}
play("Perfect player (100% first try)", 1, 0);
play("Strong player (80% first try, 5% need the worked example)", 0.8, 0.05);
play("Struggling player (45% first try, 25% need the worked example)", 0.45, 0.25);
console.log("\nall playthroughs completed");
