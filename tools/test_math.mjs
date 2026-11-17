// Stress-test every math generator: node tools/test_math.mjs [skillId to print samples]
import { allSkills, check, skillsAt, STRAND_IDS, MAX_LEVEL } from "../js/math.js";

let bad = 0;
const fail = (id, why, p) => { bad++; if (bad < 40) console.log("FAIL", id, why, JSON.stringify(p).slice(0, 300)); };
const strip = s => String(s).replace(/<[^>]+>/g, "").replace(/,/g, "");

for (const s of allSkills()) {
  const t0 = Date.now();
  for (let i = 0; i < 400; i++) {
    let p;
    try { p = s.gen(); } catch (e) { fail(s.id, "threw " + e.message, {}); break; }
    if (!p.q || !p.hint || !Array.isArray(p.steps) || !p.steps.length) fail(s.id, "missing text", p);
    if (/undefined|NaN|null/.test(JSON.stringify(p))) fail(s.id, "undefined/NaN in output", p);
    if (p.type === "num") {
      if (typeof p.ans !== "number" || !isFinite(p.ans) || p.ans < 0) fail(s.id, "bad num ans", p);
      if (!p.dec && !Number.isInteger(p.ans)) fail(s.id, "non-integer without dec", p);
      if (!check(p, String(p.ans)).ok) fail(s.id, "own answer rejected", p);
      if (check(p, String(p.ans + 1)).ok) fail(s.id, "wrong answer accepted", p);
      // the worked solution must end on the answer
      const last = strip(p.steps[p.steps.length - 1]);
      if (!last.includes(String(p.ans))) fail(s.id, "last step lacks answer: " + last, p);
      if (p.vert) {
        const [a, ...rest] = p.vert.rows;
        const calc = p.vert.op === "+" ? p.vert.rows.reduce((x, y) => x + y, 0) : p.vert.op === "−" ? a - rest[0] : a * rest[0];
        if (calc !== p.ans) fail(s.id, "vertical mismatch", p);
      }
    } else if (p.type === "choice") {
      if (!(p.ans >= 0 && p.ans < p.choices.length)) fail(s.id, "bad choice ans", p);
      if (new Set(p.choices).size !== p.choices.length) fail(s.id, "duplicate choices", p);
    } else if (p.type === "frac") {
      if (!(p.ans.n > 0 && p.ans.d > 0)) fail(s.id, "bad frac", p);
      if (!check(p, p.ans).ok) fail(s.id, "own frac rejected", p);
    } else if (p.type === "rem") {
      if (!(p.ans.q > 0 && p.ans.r > 0) || !p.labels) fail(s.id, "bad rem", p);
      if (!check(p, p.ans).ok) fail(s.id, "own rem rejected", p);
    } else fail(s.id, "unknown type", p);
  }
  if (Date.now() - t0 > 1500) console.log("SLOW", s.id, Date.now() - t0, "ms");
}

for (const st of STRAND_IDS) for (let l = 1; l <= MAX_LEVEL; l++)
  if (!skillsAt(st, l).length) { bad++; console.log("EMPTY LEVEL", st, l); }

console.log(`${allSkills().length} skills checked, ${bad} failures`);

const want = process.argv[2];
if (want) for (const s of allSkills().filter(s => want === "all" || s.id.startsWith(want))) {
  const p = s.gen();
  console.log(`\n[${s.strand}${s.level}] ${s.id} — ${s.name}\n  Q: ${strip(p.q)}${p.vert ? "  " + p.vert.rows.join(` ${p.vert.op} `) : ""}\n  A: ${JSON.stringify(p.ans)}${p.choices ? "  of " + p.choices.map(strip).join(" | ") : ""}\n  H: ${strip(p.hint)}\n  S: ${p.steps.map(strip).join("  →  ")}`);
}
