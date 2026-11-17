// Math engine: five strands, ten levels each. Every skill is a small generator that
// returns a plain-data problem (so a box in progress survives a reload):
//   { q, vis?, type: 'num'|'choice'|'frac'|'rem', ans, hint, steps[], unit?, dec?, vert?, choices? }
// Hints are progressive: `hint` is a nudge, `steps` is the full worked solution.

export const MAX_LEVEL = 10;
export const STRANDS = {
  PV: { name: "Place value", long: "Place value & number sense", icon: "🔢" },
  AS: { name: "Add & subtract", long: "Addition & subtraction", icon: "➕" },
  MD: { name: "Multiply & divide", long: "Multiplication & division", icon: "✖️" },
  AL: { name: "Balance & algebra", long: "Balance scales & algebra", icon: "⚖️" },
  FR: { name: "Fractions", long: "Fractions & proportion", icon: "🍰" },
};
export const STRAND_IDS = Object.keys(STRANDS);

// ───────── helpers
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = ri(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const chance = p => Math.random() < p;
const cap = s => s[0].toUpperCase() + s.slice(1);
export const fmt = n => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
const PLACES = ["units", "tens", "hundreds", "thousands", "ten-thousands", "hundred-thousands", "millions"];
const digitsOf = n => String(n).split("").map(Number);
const b = s => `<b>${s}</b>`;

function until(make, ok, tries = 400) {
  let v;
  for (let i = 0; i < tries; i++) { v = make(); if (ok(v)) return v; }
  return v;
}

// A number with Montessori place-value colors: units green, tens blue, hundreds red (repeating).
export function pvn(n) {
  const s = String(n); let out = "";
  for (let i = 0; i < s.length; i++) {
    const place = s.length - 1 - i;
    out += `<span class="${["pu", "pt", "ph"][place % 3]}">${s[i]}</span>`;
    if (place % 3 === 0 && place > 0) out += `<span class="pc">,</span>`;
  }
  return `<span class="pvn">${out}</span>`;
}
const frac = (n, d) => `<span class="fr"><i>${n}</i><i>${d}</i></span>`;
const eq = s => `<div class="eq">${s}</div>`;
const gcd = (a, c) => c ? gcd(c, a % c) : a;
const NTH = { 2: ["half", "halves"], 3: ["third", "thirds"], 4: ["quarter", "quarters"], 5: ["fifth", "fifths"], 6: ["sixth", "sixths"], 7: ["seventh", "sevenths"], 8: ["eighth", "eighths"], 9: ["ninth", "ninths"], 10: ["tenth", "tenths"], 12: ["twelfth", "twelfths"] };
const nth = (d, n = 2) => NTH[d] ? NTH[d][n === 1 ? 0 : 1] : `${d}ths`;

// ───────── visuals
function stamps({ th = 0, h = 0, t = 0, u = 0 }) {
  const col = (n, cls, label) => n ? `<div class="stcol">${`<span class="stamp ${cls}">${label}</span>`.repeat(n)}</div>` : "";
  return `<div class="stamps">${col(th, "s1000", "1000")}${col(h, "s100", "100")}${col(t, "s10", "10")}${col(u, "s1", "1")}</div>`;
}

function beadFrame(n) {
  const ds = digitsOf(n).reverse(); // units first, like the top wire of the frame
  const colors = ["#2f9e56", "#2f6fd6", "#d64545", "#2f9e56"], labels = ["1", "10", "100", "1000"];
  let rows = "";
  for (let i = 0; i < 4; i++) {
    const y = 24 + i * 30, d = ds[i] || 0;
    let beads = "";
    for (let k = 0; k < 10 - d; k++) beads += `<circle cx="${62 + k * 19}" cy="${y}" r="9" fill="${colors[i]}"/>`;
    for (let k = 0; k < d; k++) beads += `<circle cx="${282 - k * 19}" cy="${y}" r="9" fill="${colors[i]}" stroke="#fff" stroke-width="1.5"/>`;
    rows += `<line x1="48" y1="${y}" x2="296" y2="${y}" stroke="#8a7a66" stroke-width="2"/>${beads}
      <text x="24" y="${y + 5}" text-anchor="middle" font-size="12" font-weight="700" fill="${colors[i]}">${labels[i]}</text>`;
  }
  return `<svg class="beadframe" viewBox="0 0 310 146" role="img" aria-label="bead frame">
    <rect x="44" y="4" width="258" height="138" rx="8" fill="none" stroke="#8a7a66" stroke-width="5"/>${rows}
    <text x="252" y="141" font-size="9" fill="#8a7a66" text-anchor="middle">counted beads →</text></svg>`;
}

// Items: "x" is the mystery rock, a number is a labeled weight.
function balance(L, R) {
  const sz = 32, gap = 4;
  const pan = (cx, items) => {
    let out = "";
    for (let i = 0, r = 0; i < items.length; i += 4, r++) {
      const row = items.slice(i, i + 4), w = row.length * (sz + gap) - gap, y = 112 - (r + 1) * (sz + gap);
      row.forEach((it, k) => {
        const x = cx - w / 2 + k * (sz + gap);
        out += it === "x"
          ? `<path d="M${x + 4} ${y + sz} l-3 -14 l6 -13 l12 -5 l10 6 l4 14 l-4 12 z" fill="#7a6a5c" stroke="#4c4038" stroke-width="1.5"/><text x="${x + sz / 2}" y="${y + 23}" text-anchor="middle" font-size="16" font-style="italic" font-weight="700" fill="#fff">x</text>`
          : `<path d="M${x + 5} ${y + 4} h${sz - 10} l5 ${sz - 4} h-${sz} z" fill="#e7b53c" stroke="#a87b12" stroke-width="1.5"/><text x="${x + sz / 2}" y="${y + 24}" text-anchor="middle" font-size="${String(it).length > 2 ? 11 : 14}" font-weight="700" fill="#4a3500">${it}</text>`;
      });
    }
    return out + `<path d="M${cx - 76} 114 h152 l-14 12 h-124 z" fill="#c9cfd8" stroke="#7b8594" stroke-width="1.5"/>`;
  };
  return `<svg class="balance" viewBox="0 0 340 168" role="img" aria-label="a balanced scale">
    ${pan(86, L)}${pan(254, R)}
    <rect x="20" y="126" width="300" height="7" rx="3" fill="#7b8594"/>
    <path d="M170 133 l-22 30 h44 z" fill="#7b8594"/>
    <text x="170" y="20" text-anchor="middle" font-size="12" fill="#7b8594">perfectly balanced</text></svg>`;
}

function fracBar(k, n) {
  let cells = "";
  for (let i = 0; i < n; i++) cells += `<span class="${i < k ? "on" : ""}"></span>`;
  return `<div class="fracbar">${cells}</div>`;
}

// ───────── arithmetic helpers
const carries = nums => { let c = 0, k = 0; for (let p = 0; p < 8; p++) { const s = nums.reduce((a, n) => a + Math.floor(n / 10 ** p) % 10, 0) + c; c = Math.floor(s / 10); if (c) k++; } return k; };
const borrows = (a, c) => { let br = 0, k = 0; for (let p = 0; p < 8; p++) { const da = Math.floor(a / 10 ** p) % 10 - br, dc = Math.floor(c / 10 ** p) % 10; br = da < dc ? 1 : 0; if (br) k++; } return k; };
const nd = d => ri(10 ** (d - 1), 10 ** d - 1);

function addSteps(nums) {
  const len = Math.max(...nums.map(n => String(n).length)), steps = [];
  let carry = 0;
  for (let p = 0; p < len; p++) {
    const ds = nums.map(n => Math.floor(n / 10 ** p) % 10);
    const sum = ds.reduce((a, c) => a + c, 0) + carry;
    let line = `${cap(PLACES[p])}: ${ds.join(" + ")}${carry ? ` + ${carry} carried` : ""} = ${sum}.`;
    carry = Math.floor(sum / 10);
    if (carry) line += ` Write ${sum % 10} and exchange ${carry * 10} ${PLACES[p]} for ${carry} ${carry === 1 ? PLACES[p + 1].replace(/s$/, "") : PLACES[p + 1]}.`;
    steps.push(line);
  }
  steps.push(`Altogether: ${b(fmt(nums.reduce((a, c) => a + c, 0)))}`);
  return steps;
}

function subSteps(a, c) {
  const da = digitsOf(a).reverse(), dc = digitsOf(c).reverse(), steps = [];
  for (let p = 0; p < da.length; p++) {
    const sub = dc[p] || 0;
    if (da[p] < sub) {
      let q = p + 1; while (da[q] === 0) q++;
      da[q]--; for (let r = q - 1; r > p; r--) da[r] = 9; da[p] += 10;
      steps.push(`${cap(PLACES[p])}: not enough to take away ${sub}! Exchange from the ${PLACES[q]} so you have ${da[p]} ${PLACES[p]}. Then ${da[p]} − ${sub} = ${da[p] - sub}.`);
    } else steps.push(`${cap(PLACES[p])}: ${da[p]} − ${sub} = ${da[p] - sub}.`);
  }
  steps.push(`What is left: ${b(fmt(a - c))}`);
  return steps;
}

function chunkDivide(a, d) {
  const steps = []; let rem = a, parts = [];
  for (const place of [1000, 100, 10]) {
    const q = Math.floor(rem / (d * place));
    if (q > 0) { steps.push(`${d} × ${fmt(q * place)} = ${fmt(d * q * place)}. Take that away: ${fmt(rem)} − ${fmt(d * q * place)} = ${fmt(rem - d * q * place)} left.`); rem -= d * q * place; parts.push(q * place); }
  }
  const q = Math.floor(rem / d);
  if (q > 0 || !parts.length) { steps.push(`${d} × ${q} = ${d * q}${rem - d * q ? `, with ${rem - d * q} left over` : ""}.`); parts.push(q); }
  else if (rem) steps.push(`${rem} is left over.`);
  if (parts.length > 1) steps.push(`Add the pieces: ${parts.map(fmt).join(" + ")} = ${b(fmt(Math.floor(a / d)))}`);
  else steps.push(`So the answer is ${b(fmt(Math.floor(a / d)))}`);
  return steps;
}

// ───────── rock-flavored story wrappers
const ADD_STORIES = [
  (a, c) => [`A quarry truck hauled ${b(fmt(a))} kg of granite before lunch and ${b(fmt(c))} kg after lunch. How many kilograms in all?`, "kg"],
  (a, c) => [`The museum has ${b(fmt(a))} minerals on display and ${b(fmt(c))} more in its storage drawers. How many minerals altogether?`, "minerals"],
  (a, c) => [`A rockhound club found ${b(fmt(a))} agates on Saturday and ${b(fmt(c))} on Sunday. How many agates is that?`, "agates"],
  (a, c) => [`One geode weighs ${b(fmt(a))} grams. Another weighs ${b(fmt(c))} grams. How much do they weigh together?`, "grams"],
];
const SUB_STORIES = [
  (a, c) => [`A mine dug up ${b(fmt(a))} kg of copper ore and shipped away ${b(fmt(c))} kg. How many kilograms are left?`, "kg"],
  (a, c) => [`The gem show had ${b(fmt(a))} crystals for sale. ${b(fmt(c))} were sold. How many are left?`, "crystals"],
  (a, c) => [`A cave is ${b(fmt(a))} meters long. Explorers have mapped ${b(fmt(c))} meters. How many meters are still unmapped?`, "meters"],
  (a, c) => [`A boulder weighed ${b(fmt(a))} kg. Sculptors chipped away ${b(fmt(c))} kg. How much does the statue weigh?`, "kg"],
];

function addProb(nums, { vertical = false, story = 0.35 } = {}) {
  const total = nums.reduce((a, c) => a + c, 0);
  const p = { type: "num", ans: total, steps: addSteps(nums),
    hint: vertical ? "Start with the green units column. If a column makes 10 or more, exchange 10 for 1 of the next place." : "Add the tens first, then the units, then put them together." };
  if (!vertical) {
    const [x, y] = nums;
    p.steps = [`Tens: ${x - x % 10} + ${y - y % 10} = ${x - x % 10 + y - y % 10}`, `Units: ${x % 10} + ${y % 10} = ${x % 10 + y % 10}`, `${x - x % 10 + y - y % 10} + ${x % 10 + y % 10} = ${b(total)}`];
    if (y < 10) p.hint = "Make a ten first: how many does the first number need to reach the next ten?";
    if (y < 10) p.steps = [`${x} needs ${10 - x % 10} more to reach ${x - x % 10 + 10}.`, `Split ${y} into ${10 - x % 10} and ${y - (10 - x % 10)}.`, `${x - x % 10 + 10} + ${y - (10 - x % 10)} = ${b(total)}`];
  }
  if (nums.length === 2 && chance(story)) { const [q, unit] = pick(ADD_STORIES)(nums[0], nums[1]); p.q = q; p.unit = unit; }
  else p.q = vertical ? "Add." : eq(`${nums.join(" + ")} = ?`);
  if (vertical) p.vert = { rows: nums, op: "+" };
  return p;
}

function subProb(a, c, { vertical = false, story = 0.35 } = {}) {
  const p = { type: "num", ans: a - c, steps: subSteps(a, c),
    hint: vertical ? "Start with the green units. If the top digit is too small, exchange 1 from the next place for 10." : "Take away the tens first, then the units." };
  if (!vertical) {
    if (c < 10) p.hint = "Take away just enough to land on a ten. Then take away the rest.";
    p.steps = c < 10
      ? [`Take away ${a % 10} to land on ${a - a % 10}.`, `You still need to take away ${c - a % 10} more.`, `${a - a % 10} − ${c - a % 10} = ${b(a - c)}`]
      : [`${a} − ${c - c % 10} = ${a - (c - c % 10)}`, `${a - (c - c % 10)} − ${c % 10} = ${b(a - c)}`];
  }
  if (chance(story)) { const [q, unit] = pick(SUB_STORIES)(a, c); p.q = q; p.unit = unit; }
  else p.q = vertical ? "Subtract." : eq(`${a} − ${c} = ?`);
  if (vertical) p.vert = { rows: [a, c], op: "−" };
  return p;
}

// ───────── skills
const SKILLS = [];
const skill = (id, strand, level, name, gen) => SKILLS.push({ id, strand, level, name, gen });

/* ══════════ PV · place value & number sense ══════════ */
function digitValue(len) {
  const ds = until(() => shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, len), () => true);
  const n = Number(ds.join("")), i = ri(0, len - 1), place = len - 1 - i, d = ds[i], val = d * 10 ** place;
  const shown = ds.map((x, k) => (k === i ? `<u>${x}</u>` : x) + ((len - 1 - k) % 3 === 0 && k < len - 1 ? "," : "")).join("");
  const ctx = len <= 4
    ? pick([`A boulder weighs ${shown} kilograms.`, `A mine tunnel is ${shown} meters long.`, `A museum owns ${shown} specimens.`, `A geode weighs ${shown} grams.`])
    : pick([`A quarry shipped ${shown} kilograms of gravel.`, `The gem show had ${shown} visitors.`, `A gold mine has dug out ${shown} tons of rock.`, `A beach was measured to have ${shown} pebbles.`]);
  return { q: `${ctx}<br>What is the <b>value</b> of the underlined ${d}?`, type: "num", ans: val,
    hint: `Count the places from the right: units, tens, hundreds… Which place is the ${d} sitting in?`,
    steps: [`Here it is in place-value colors: ${pvn(n)}`, `The ${d} is in the ${b(PLACES[place])} place.`, `${d} ${PLACES[place]} = ${b(fmt(val))}`] };
}
function expanded(len, mix) {
  const ds = until(() => Array.from({ length: len }, (_, k) => k === 0 ? ri(1, 9) : (chance(0.25) ? 0 : ri(1, 9))), a => a.filter(Boolean).length >= 3);
  const n = Number(ds.join(""));
  let parts = ds.map((d, k) => d * 10 ** (len - 1 - k)).filter(Boolean);
  if (mix) parts = shuffle(parts);
  return { q: eq(`${parts.map(fmt).join(" + ")} = ?`), type: "num", ans: n,
    hint: mix ? "The parts are scrambled! Find the biggest part first, then the next biggest." : "Each part fills one place. A missing place gets a zero.",
    steps: [`Biggest to smallest: ${parts.slice().sort((x, y) => y - x).map(fmt).join(", ")}`, ...(ds.includes(0) ? ["A place with nothing in it gets a 0."] : []), `Put them together: ${pvn(n)}`] };
}
function compare(len) {
  const a = nd(len), keep = ri(1, len - 1);
  const c = until(() => Number(String(a).slice(0, keep) + String(nd(len)).slice(keep)), v => v !== a);
  const ctx = pick([`Two quarries shipped ${b(fmt(a))} kg and ${b(fmt(c))} kg of stone.`, `Two meteorites weigh ${b(fmt(a))} grams and ${b(fmt(c))} grams.`, `Two museums own ${b(fmt(a))} and ${b(fmt(c))} specimens.`]);
  const i = String(a).split("").findIndex((ch, k) => ch !== String(c)[k]);
  return { q: `${ctx}<br>Which number is <b>greater</b>?`, type: "choice", choices: [fmt(a), fmt(c)], ans: a > c ? 0 : 1,
    hint: "Compare from the left. The first place where the digits are different decides it.",
    steps: [`${pvn(a)} and ${pvn(c)}`, `They are the same until the ${b(PLACES[len - 1 - i])} place.`, `There, ${String(a)[i]} vs ${String(c)[i]} — so ${b(fmt(Math.max(a, c)))} is greater.`] };
}

skill("pv_stamps3", "PV", 1, "Read Stamp Game stamps", () => {
  const h = ri(1, 9), t = ri(0, 9), u = ri(1, 9), n = h * 100 + t * 10 + u;
  return { q: "What number do these stamps make?", vis: stamps({ h, t, u }), type: "num", ans: n,
    hint: "Count each color. Red stamps are hundreds, blue are tens, green are units.",
    steps: [`${h} red hundreds = ${h * 100}`, `${t} blue tens = ${t * 10}`, `${u} green units = ${u}`, `${h * 100} + ${t * 10} + ${u} = ${b(n)}`] };
});
skill("pv_digit3", "PV", 1, "Value of a digit (3 digits)", () => digitValue(3));
skill("pv_digit4", "PV", 2, "Value of a digit (4 digits)", () => digitValue(4));
skill("pv_expand4", "PV", 2, "Expanded form (4 digits)", () => expanded(4, false));
skill("pv_bead4", "PV", 2, "Read the bead frame", () => {
  const n = until(() => nd(4), v => digitsOf(v).filter(Boolean).length >= 3);
  const ds = digitsOf(n);
  return { q: "The beads pushed to the right have been counted. What number is on the bead frame?", vis: beadFrame(n), type: "num", ans: n,
    hint: "Top wire is units, then tens, hundreds, thousands. Count only the beads on the right side of each wire.",
    steps: [`Bottom wire: ${ds[0]} thousands`, `Next: ${ds[1]} hundreds`, `Next: ${ds[2]} tens`, `Top wire: ${ds[3]} units`, `That makes ${pvn(n)}`] };
});
skill("pv_exchange", "PV", 3, "Stamps that need exchanging", () => {
  const h = ri(1, 7), big = chance(0.5), t = big ? ri(10, 14) : ri(0, 8), u = big ? ri(0, 9) : ri(10, 15), n = h * 100 + t * 10 + u;
  return { q: "Some of these stamps need to be exchanged! What number do they make?", vis: stamps({ h, t, u }), type: "num", ans: n,
    hint: "Ten of one kind can be exchanged for one of the next kind: 10 units → 1 ten, 10 tens → 1 hundred.",
    steps: [big ? `${t} tens = 1 hundred and ${t - 10} tens` : `${u} units = 1 ten and ${u - 10} units`,
      `After exchanging: ${Math.floor(n / 100)} hundreds, ${Math.floor(n / 10) % 10} tens, ${n % 10} units`, `That makes ${b(n)}`] };
});
skill("pv_compare4", "PV", 3, "Compare 4-digit numbers", () => compare(4));
skill("pv_more", "PV", 3, "10, 100, or 1,000 more or less", () => {
  const d = pick([10, 100, 1000]), up = chance(0.6);
  const n = until(() => nd(4), v => (up ? v + d < 10000 : v - d > 999) && (chance(0.5) || Math.floor(v / d) % 10 === (up ? 9 : 0)));
  const ans = up ? n + d : n - d;
  return { q: `What is ${b(fmt(d))} ${up ? "more" : "less"} than ${b(fmt(n))}?`, type: "num", ans,
    hint: `Change the ${PLACES[String(d).length - 1]} digit by one. Careful — if it rolls past ${up ? 9 : 0}, the next place changes too!`,
    steps: [`${pvn(n)} — look at the ${PLACES[String(d).length - 1]} place.`, `${fmt(n)} ${up ? "+" : "−"} ${fmt(d)} = ${b(fmt(ans))}`] };
});
function rounding(n, to) {
  const lo = Math.floor(n / to) * to, hi = lo + to, mid = lo + to / 2, ans = n < mid ? lo : hi;
  const name = { 10: "ten", 100: "hundred", 1000: "thousand" }[to];
  return { q: `A boulder weighs ${b(fmt(n))} kg. Round that to the nearest ${b(name)}.`, type: "num", ans, unit: "kg",
    hint: `Which two ${name}s is ${fmt(n)} between? Which one is it closer to?`,
    steps: [`${fmt(n)} is between ${fmt(lo)} and ${fmt(hi)}.`, `Halfway is ${fmt(mid)}.`, `${fmt(n)} is ${n < mid ? "below" : "past"} halfway, so it rounds ${n < mid ? "down" : "up"} to ${b(fmt(ans))}.`] };
}
skill("pv_round", "PV", 4, "Round to the nearest 10 or 100", () => {
  const to = pick([10, 100]);
  return rounding(until(() => ri(120, 9899), v => v % to !== 0 && v % to !== to / 2), to);
});
skill("pv_pattern", "PV", 4, "Skip-counting patterns", () => {
  const step = pick([25, 50, 150, 250, 500, 11, 15, 20, 99, 101]), down = chance(0.3);
  const start = step * ri(1, 6) + (chance(0.4) ? ri(1, 9) : 0);
  const seq = Array.from({ length: 5 }, (_, k) => down ? start + step * (8 - k) : start + step * k);
  return { q: `What comes next?${eq(`${seq.slice(0, 4).map(fmt).join(", ")}, ?`)}`, type: "num", ans: seq[4],
    hint: "How far is it from each number to the next one? It is the same jump every time.",
    steps: [`${fmt(seq[1])} − ${fmt(seq[0])} = ${down ? "−" : ""}${step}, so each jump is ${step} ${down ? "less" : "more"}.`, `${fmt(seq[3])} ${down ? "−" : "+"} ${step} = ${b(fmt(seq[4]))}`] };
});
skill("pv_halfway", "PV", 4, "Find the halfway number", () => {
  const span = pick([10, 100, 1000]), lo = span * ri(1, 9) * (span === 10 ? ri(1, 9) : 1);
  return { q: `What number is exactly halfway between ${b(fmt(lo))} and ${b(fmt(lo + span))}?`, type: "num", ans: lo + span / 2,
    hint: `The two numbers are ${fmt(span)} apart. What is half of ${fmt(span)}?`,
    steps: [`They are ${fmt(span)} apart.`, `Half of ${fmt(span)} is ${fmt(span / 2)}.`, `${fmt(lo)} + ${fmt(span / 2)} = ${b(fmt(lo + span / 2))}`] };
});
skill("pv_digit6", "PV", 5, "Value of a digit (5–6 digits)", () => digitValue(ri(5, 6)));
skill("pv_expand6", "PV", 5, "Scrambled expanded form (5–6 digits)", () => expanded(ri(5, 6), true));
skill("pv_compare6", "PV", 5, "Compare 5- and 6-digit numbers", () => compare(ri(5, 6)));
skill("pv_round1000", "PV", 6, "Round to the nearest 1,000", () => rounding(until(() => ri(1200, 98999), v => v % 1000 !== 0 && v % 1000 !== 500), 1000));
skill("pv_x10", "PV", 6, "Multiply and divide by 10, 100, 1,000", () => {
  const m = pick([10, 100, 1000]), a = ri(12, 480);
  if (chance(0.6)) return { q: eq(`${fmt(a)} × ${fmt(m)} = ?`), type: "num", ans: a * m,
    hint: `Multiplying by ${fmt(m)} slides every digit ${String(m).length - 1} place${m > 10 ? "s" : ""} to the left. Zeros fill the empty places.`,
    steps: [`${fmt(a)} × ${fmt(m)}: slide the digits left and fill with ${String(m).length - 1} zero${m > 10 ? "s" : ""}.`, `${b(fmt(a * m))}`] };
  return { q: eq(`${fmt(a * m)} ÷ ${fmt(m)} = ?`), type: "num", ans: a,
    hint: `Dividing by ${fmt(m)} slides every digit ${String(m).length - 1} place${m > 10 ? "s" : ""} to the right.`,
    steps: [`${fmt(a * m)} ÷ ${fmt(m)}: slide the digits right — the last ${String(m).length - 1} zero${m > 10 ? "s" : ""} drop off.`, `${b(fmt(a))}`] };
});
skill("pv_howmany", "PV", 6, "How many tens / hundreds in a number", () => {
  const [unit, name] = pick([[10, "tens"], [100, "hundreds"], [1000, "thousands"]]), k = ri(11, 98);
  return { q: `A crate holds ${fmt(unit)} pebbles. How many full crates do you need for ${b(fmt(k * unit))} pebbles?<br><small>(How many ${name} are in ${fmt(k * unit)}?)</small>`, type: "num", ans: k, unit: "crates",
    hint: `Count by ${name}. ${fmt(unit * 10)} has 10 ${name} in it.`,
    steps: [`${fmt(k * unit)} ÷ ${fmt(unit)} — slide the digits ${String(unit).length - 1} place${unit > 10 ? "s" : ""} to the right.`, `There are ${b(k)} ${name} in ${fmt(k * unit)}.`] };
});
skill("pv_millions", "PV", 7, "Write numbers in the millions", () => {
  const M = ri(1, 9), K = pick([0, 0, 5, 20, 50, 250, 400, 706, 80]) || ri(1, 99) * 10, ans = M * 1e6 + K * 1e3;
  const thing = pick(["years old", "tons of iron ore", "grains of sand", "kilometers from the Sun"]);
  return { q: `A scientist writes: “${b(`${M} million ${K} thousand`)} ${thing}.”<br>Write that number using digits.`, type: "num", ans,
    hint: "A million has six digits after it. The thousands fill the middle three places, and the last three are zeros.",
    steps: [`Millions: ${M}`, `Thousands (always three digits): ${String(K).padStart(3, "0")}`, `Units: 000`, `${pvn(ans)}`] };
});
skill("pv_digit7", "PV", 7, "Value of a digit (7 digits)", () => digitValue(7));
skill("pv_million_more", "PV", 7, "Big jumps: 10,000 / 100,000 / 1,000,000 more", () => {
  const d = pick([10000, 100000, 1000000]), up = chance(0.65);
  const n = until(() => ri(1200, 9899) * 1000, v => up || v - d > 1e6);
  const ans = up ? n + d : n - d;
  return { q: `What is ${b(fmt(d))} ${up ? "more" : "less"} than ${b(fmt(n))}?`, type: "num", ans,
    hint: `Only the ${PLACES[String(d).length - 1]} place changes — unless it rolls over!`,
    steps: [`${pvn(n)} — find the ${PLACES[String(d).length - 1]} place.`, `${fmt(n)} ${up ? "+" : "−"} ${fmt(d)} = ${b(fmt(ans))}`] };
});
const MOHS = [["Gypsum", 2], ["A fingernail", 2.5], ["Calcite", 3], ["A copper coin", 3.5], ["Fluorite", 4], ["Apatite", 5], ["Window glass", 5.5], ["Orthoclase", 6], ["Pyrite", 6.5], ["Quartz", 7], ["Garnet", 7.5], ["Topaz", 8], ["Chrysoberyl", 8.5], ["Corundum", 9]];
const SG = [["Gold", 19.3], ["Silver", 10.5], ["Copper", 8.9], ["Galena", 7.5], ["Hematite", 5.3], ["Barite", 4.5], ["Garnet", 4.2], ["Diamond", 3.5], ["Fluorite", 3.2], ["Calcite", 2.7], ["Quartz", 2.65], ["Halite", 2.2], ["Sulfur", 2.1], ["Borax", 1.7]];
skill("dec_compare", "PV", 8, "Compare decimals (Mohs hardness)", () => {
  const [x, y] = until(() => shuffle(MOHS).slice(0, 2), ([p, q]) => Math.abs(p[1] - q[1]) <= 1.5 && (p[1] % 1 || q[1] % 1));
  return { q: `On the Mohs scale, ${x[0].toLowerCase()} has hardness ${b(x[1])} and ${y[0].toLowerCase()} has hardness ${b(y[1])}.<br>Which one is harder?`, type: "choice", choices: [x[0], y[0]], ans: x[1] > y[1] ? 0 : 1,
    hint: "The .5 means “and a half.” So 3.5 is halfway between 3 and 4.",
    steps: [`${x[1]} and ${y[1]} — think of them on a number line.`, `${Math.max(x[1], y[1])} is greater than ${Math.min(x[1], y[1])}.`, `${b((x[1] > y[1] ? x : y)[0])} is harder, so it can scratch the other one.`] };
});
skill("dec_halfway", "PV", 8, "Decimals: halfway between whole numbers", () => {
  const lo = ri(1, 9);
  return { q: `A mineral's hardness is exactly halfway between ${b(lo)} and ${b(lo + 1)}. What is its hardness?`, type: "num", dec: true, ans: lo + 0.5,
    hint: "Halfway between two whole numbers is “and a half.” A half is written .5",
    steps: [`Halfway between ${lo} and ${lo + 1} is ${lo} and a half.`, `One half as a decimal is 0.5`, `${lo} + 0.5 = ${b(lo + 0.5)}`] };
});
skill("dec_tenths", "PV", 8, "Decimals: the tenths place", () => {
  const [name, v] = until(() => pick(SG), x => Math.round(x[1] * 10) % 10 !== 0 && Number.isInteger(x[1] * 10));
  const whole = Math.floor(v), tenths = Math.round(v * 10) % 10, askWhole = chance(0.3);
  return { q: `${name} is ${b(v)} times as heavy as water.<br>Which digit is in the <b>${askWhole ? "units" : "tenths"}</b> place?`, type: "num", ans: askWhole ? whole % 10 : tenths,
    hint: "The decimal point sits right after the units. The first digit after the point is the tenths.",
    steps: [`In ${v}, the units digit (just left of the point) is ${whole % 10}.`, `The tenths digit (just right of the point) is ${tenths}.`, `The answer is ${b(askWhole ? whole % 10 : tenths)}`] };
});
skill("dec_add", "PV", 9, "Add and subtract tenths", () => {
  if (chance(0.5)) {
    const [x, y] = until(() => shuffle(MOHS).slice(0, 2), ([p, q]) => p[1] > q[1] && (p[1] % 1 || q[1] % 1));
    const ans = x[1] - y[1];
    return { q: `${x[0]} has hardness ${b(x[1])}. ${y[0]} has hardness ${b(y[1])}.<br>How many steps apart are they on the Mohs scale?`, type: "num", dec: true, ans,
      hint: "Subtract the smaller from the larger. You can count up in halves: 3.5 → 4 → 4.5 …",
      steps: [`${x[1]} − ${y[1]}`, `Count up from ${y[1]} to ${x[1]}.`, `The difference is ${b(ans)}`] };
  }
  const x = ri(11, 89) / 10, y = ri(11, 89) / 10, ans = Math.round((x + y) * 10) / 10;
  return { q: `One crystal weighs ${b(x)} grams and another weighs ${b(y)} grams. How much do they weigh together?`, type: "num", dec: true, ans, unit: "grams",
    hint: "Add the whole numbers, then add the tenths. Ten tenths make one whole.",
    steps: [`Wholes: ${Math.floor(x)} + ${Math.floor(y)} = ${Math.floor(x) + Math.floor(y)}`, `Tenths: ${Math.round(x * 10) % 10} + ${Math.round(y * 10) % 10} = ${Math.round(x * 10) % 10 + Math.round(y * 10) % 10} tenths`, `Together: ${b(ans)}`] };
});
skill("dec_x10", "PV", 9, "Decimals × 10 and ÷ 10", () => {
  const v = pick(SG.filter(x => Number.isInteger(x[1] * 10)));
  if (chance(0.6)) return { q: `A bucket of water weighs 10 kg. ${v[0]} is ${b(v[1])} times as heavy as water.<br>How much would the same bucket full of ${v[0].toLowerCase()} weigh?`, type: "num", dec: true, ans: Math.round(v[1] * 10), unit: "kg",
    hint: "Multiply by 10: every digit slides one place to the left, across the decimal point.",
    steps: [`${v[1]} × 10`, `Slide each digit one place left.`, `${b(Math.round(v[1] * 10))} kg`] };
  const n = ri(12, 98);
  return { q: eq(`${n} ÷ 10 = ?`), type: "num", dec: true, ans: n / 10,
    hint: "Dividing by 10 slides every digit one place to the right. The units digit moves into the tenths place.",
    steps: [`${n} ÷ 10: the ${n % 10} slides into the tenths place.`, `${b(n / 10)}`] };
});
skill("dec_compare100", "PV", 10, "Compare tenths and hundredths", () => {
  const w = ri(1, 9), t = ri(1, 8), x = w + t / 10 + ri(1, 9) / 100, y = w + (t + pick([0, 1])) / 10 + (chance(0.5) ? 0 : ri(1, 9) / 100);
  const xs = Number(x.toFixed(2)), ys = Number(y.toFixed(2));
  if (xs === ys) return SKILLS.find(s => s.id === "dec_compare100").gen();
  return { q: `Two mystery minerals are tested. One is ${b(xs)} times as heavy as water. The other is ${b(ys)} times as heavy.<br>Which number is greater?`, type: "choice", choices: [String(xs), String(ys)], ans: xs > ys ? 0 : 1,
    hint: "Line up the decimal points. You can add a zero to the end so both have two digits after the point: 2.7 is the same as 2.70",
    steps: [`Write both with two decimal places: ${xs.toFixed(2)} and ${ys.toFixed(2)}`, `Compare from the left, digit by digit.`, `${b(Math.max(xs, ys))} is greater.`] };
});
skill("dec_round", "PV", 10, "Round decimals", () => {
  if (chance(0.5)) { const v = Number((ri(1, 19) + ri(1, 9) / 10 + pick([1, 2, 3, 4, 6, 7, 8, 9]) / 100).toFixed(2)), ans = Math.round(v * 10) / 10;
    return { q: `A scale reads ${b(v)} grams. Round it to the nearest <b>tenth</b>.`, type: "num", dec: true, ans, unit: "grams",
      hint: "Look at the hundredths digit. 5 or more rounds the tenths up; 4 or less leaves them alone.",
      steps: [`The hundredths digit is ${Math.round(v * 100) % 10}.`, `That is ${Math.round(v * 100) % 10 >= 5 ? "5 or more, so round up" : "less than 5, so keep the tenths"}.`, `${b(ans)}`] }; }
  const v = Number((ri(1, 19) + pick([1, 2, 3, 4, 6, 7, 8, 9]) / 10).toFixed(1)), ans = Math.round(v);
  return { q: `A crystal is ${b(v)} centimeters long. Round it to the nearest <b>whole number</b>.`, type: "num", ans, unit: "cm",
    hint: "Look at the tenths digit. 5 or more rounds up; 4 or less rounds down.",
    steps: [`${v} is between ${Math.floor(v)} and ${Math.floor(v) + 1}.`, `The tenths digit is ${Math.round(v * 10) % 10}.`, `It rounds to ${b(ans)}`] };
});
skill("dec_add100", "PV", 10, "Add decimals with hundredths", () => {
  const x = Number((ri(1, 6) + ri(11, 89) / 100).toFixed(2)), y = Number((ri(1, 3) + ri(1, 9) / 10).toFixed(1)), ans = Number((x + y).toFixed(2));
  return { q: eq(`${x} + ${y} = ?`), type: "num", dec: true, ans,
    hint: `Line up the decimal points. ${y} is the same as ${y.toFixed(2)}`,
    steps: [`Write ${y} as ${y.toFixed(2)}`, `${x.toFixed(2)} + ${y.toFixed(2)} — add hundredths, then tenths, then units.`, `${b(ans)}`] };
});

/* ══════════ AS · addition & subtraction ══════════ */
skill("as_add21", "AS", 1, "2-digit + 1-digit, crossing a ten", () => { const a = until(() => ri(14, 89), v => v % 10 >= 4), c = ri(11 - a % 10, 9); return addProb([a, c], { story: 0 }); });
skill("as_sub21", "AS", 1, "2-digit − 1-digit, crossing a ten", () => { const a = until(() => ri(21, 95), v => v % 10 <= 6 && v % 10 >= 1), c = ri(a % 10 + 1, 9); return subProb(a, c, { story: 0 }); });
skill("as_add22n", "AS", 1, "2-digit + 2-digit (no exchanging)", () => { const [a, c] = until(() => [ri(11, 78), ri(11, 78)], v => carries(v) === 0 && v[0] + v[1] < 100); return addProb([a, c], { story: 0.2 }); });
skill("as_add22", "AS", 2, "2-digit + 2-digit in your head", () => { const [a, c] = until(() => [ri(15, 89), ri(15, 89)], v => carries(v) >= 1 && v[0] % 10 && v[1] % 10); return addProb([a, c]); });
skill("as_sub22", "AS", 2, "2-digit − 2-digit in your head", () => { const [a, c] = until(() => [ri(31, 99), ri(12, 79)], v => v[0] - v[1] > 5 && borrows(v[0], v[1]) === 1); return subProb(a, c); });
skill("as_add3", "AS", 3, "3-digit addition with one exchange", () => { const v = until(() => [nd(3), nd(3)], x => carries(x) === 1 && x[0] + x[1] < 1000); return addProb(v, { vertical: true }); });
skill("as_sub3", "AS", 3, "3-digit subtraction with one exchange", () => { const [a, c] = until(() => [nd(3), nd(3)], x => x[0] - x[1] > 50 && borrows(x[0], x[1]) === 1); return subProb(a, c, { vertical: true }); });
skill("as_add4s", "AS", 4, "4-digit addition (static)", () => { const v = until(() => [nd(4), nd(4)], x => carries(x) === 0 && x[0] + x[1] < 10000); return addProb(v, { vertical: true }); });
skill("as_sub4s", "AS", 4, "4-digit subtraction (static)", () => { const [a, c] = until(() => [nd(4), nd(4)], x => x[0] > x[1] && borrows(x[0], x[1]) === 0); return subProb(a, c, { vertical: true }); });
skill("as_add3d", "AS", 4, "3-digit addition with two exchanges", () => { const v = until(() => [nd(3), nd(3)], x => carries(x) >= 2); return addProb(v, { vertical: true }); });
skill("as_add4d", "AS", 5, "4-digit addition (dynamic)", () => { const v = until(() => [nd(4), nd(4)], x => carries(x) >= 2 && x[0] + x[1] < 10000); return addProb(v, { vertical: true }); });
skill("as_sub4d1", "AS", 5, "4-digit subtraction with one exchange", () => { const [a, c] = until(() => [nd(4), nd(4)], x => x[0] - x[1] > 500 && borrows(x[0], x[1]) === 1); return subProb(a, c, { vertical: true }); });
skill("as_sub4d", "AS", 6, "4-digit subtraction (dynamic)", () => { const [a, c] = until(() => [nd(4), nd(4)], x => x[0] - x[1] > 300 && borrows(x[0], x[1]) >= 2 && !String(x[0]).includes("0")); return subProb(a, c, { vertical: true }); });
skill("as_add4d3", "AS", 6, "4-digit addition with three exchanges", () => { const v = until(() => [nd(4), nd(4)], x => carries(x) >= 3); return addProb(v, { vertical: true }); });
skill("as_dot", "AS", 7, "Dot Board: add three or four numbers", () => {
  const k = pick([3, 3, 4]), v = until(() => Array.from({ length: k }, () => ri(1012, 2989)), x => carries(x) >= 2);
  const p = addProb(v, { vertical: true, story: 0 });
  p.q = "Dot Board challenge! Add them all."; p.hint = "Add one column at a time, starting with the units. Use the little boxes on top to keep track of what you exchange.";
  return p;
});
skill("as_subzero", "AS", 7, "Subtracting across zeros", () => {
  const a = pick([ri(2, 9) * 1000, ri(2, 9) * 1000 + ri(1, 9), ri(2, 9) * 1000 + ri(1, 9) * 10, ri(2, 9) * 1000 + ri(1, 9) * 100 + ri(1, 9)]);
  const c = until(() => ri(1011, a - 111), x => borrows(a, x) >= 2);
  const p = subProb(a, c, { vertical: true });
  p.hint = "When the next place is zero, go one place further to exchange, then pass it along.";
  return p;
});
skill("as_add5", "AS", 8, "5-digit addition", () => { const v = until(() => [nd(5), nd(5)], x => carries(x) >= 2 && x[0] + x[1] < 100000); return addProb(v, { vertical: true }); });
skill("as_sub5", "AS", 8, "5-digit subtraction", () => { const [a, c] = until(() => [nd(5), nd(5)], x => x[0] - x[1] > 3000 && borrows(x[0], x[1]) >= 2); return subProb(a, c, { vertical: true }); });
skill("as_missing", "AS", 8, "Find the missing part", () => {
  const total = pick([1000, 2000, 5000, 10000, 6000, 8000]), a = until(() => ri(125, total - 125), v => v % 5 === 0 && v % 100 !== 0);
  return { q: `A jar holds ${b(fmt(total))} grams of polished stones when full. Right now it holds ${b(fmt(a))} grams.<br>How many more grams will fill it?${eq(`${fmt(a)} + ? = ${fmt(total)}`)}`, type: "num", ans: total - a, unit: "grams",
    hint: "Count up in friendly jumps: first to the next hundred, then to the next thousand, then to the total.",
    steps: (() => { const s = []; let x = a; const h = Math.ceil(x / 100) * 100; if (h !== x) { s.push(`${fmt(x)} + ${h - x} = ${fmt(h)}`); x = h; } const t = Math.min(total, Math.ceil(x / 1000) * 1000); if (t !== x) { s.push(`${fmt(x)} + ${fmt(t - x)} = ${fmt(t)}`); x = t; } if (x !== total) s.push(`${fmt(x)} + ${fmt(total - x)} = ${fmt(total)}`); s.push(`Add up the jumps: ${b(fmt(total - a))}`); return s; })() };
});
skill("as_add6", "AS", 9, "6-digit addition", () => { const v = until(() => [nd(6), nd(6)], x => carries(x) >= 3 && x[0] + x[1] < 1000000); return addProb(v, { vertical: true, story: 0 }); });
skill("as_sub6", "AS", 9, "6-digit subtraction", () => { const [a, c] = until(() => [nd(6), nd(6)], x => x[0] - x[1] > 30000 && borrows(x[0], x[1]) >= 3); return subProb(a, c, { vertical: true, story: 0 }); });
skill("as_twostep", "AS", 9, "Two-step story problems", () => {
  const a = ri(1200, 4800), c = ri(1100, 3900), d = ri(400, 1900), ans = a + c - d;
  return { q: `A museum had ${b(fmt(a))} specimens. A collector donated ${b(fmt(c))} more. Then the museum lent ${b(fmt(d))} to a school.<br>How many specimens does the museum have now?`, type: "num", ans, unit: "specimens",
    hint: "Two steps: first add the donation, then subtract what was lent.",
    steps: [`${fmt(a)} + ${fmt(c)} = ${fmt(a + c)}`, `${fmt(a + c)} − ${fmt(d)} = ${b(fmt(ans))}`] };
});
skill("as_chain", "AS", 10, "Long chains with big numbers", () => {
  const a = ri(31000, 68000), c = ri(11000, 29000), d = ri(4100, 9900), ans = a - c + d;
  return { q: eq(`${fmt(a)} − ${fmt(c)} + ${fmt(d)} = ?`), type: "num", ans,
    hint: "Work from left to right, one step at a time. Write down the middle answer.",
    steps: [`${fmt(a)} − ${fmt(c)} = ${fmt(a - c)}`, `${fmt(a - c)} + ${fmt(d)} = ${b(fmt(ans))}`] };
});
skill("as_gauss", "AS", 10, "The Gauss trick: add 1 to n", () => {
  const n = pick([10, 20, 40, 50, 100, 200]), ans = n * (n + 1) / 2;
  return { q: `A crystal grows 1 layer on day 1, 2 layers on day 2, 3 on day 3, and so on.<br>How many layers has it grown after ${b(n)} days?${eq(`1 + 2 + 3 + … + ${n} = ?`)}`, type: "num", ans, unit: "layers",
    hint: `When Carl Gauss was a boy, he found a trick: pair the first and last numbers. 1 + ${n} = ${n + 1}. So does 2 + ${n - 1}. How many pairs are there?`,
    steps: [`Pair them up: 1 + ${n}, 2 + ${n - 1}, 3 + ${n - 2}… every pair makes ${n + 1}.`, `${n} numbers make ${n / 2} pairs.`, `${n / 2} × ${n + 1} = ${b(fmt(ans))}`] };
});

/* ══════════ MD · multiplication & division ══════════ */
const SHAPES = [["pyrite cube", "flat faces", 6], ["quartz crystal", "long sides", 6], ["fluorite octahedron", "faces", 8], ["garnet crystal", "faces", 12], ["cube of halite", "corners", 8], ["beryl crystal", "sides", 6], ["diamond octahedron", "edges", 12]];
function timesFact(a, c) {
  const sk = Array.from({ length: Math.min(a, c) }, (_, k) => (k + 1) * Math.max(a, c));
  const steps = [`Skip-count by ${Math.max(a, c)}, ${Math.min(a, c)} times: ${sk.join(", ")}`, `${a} × ${c} = ${b(a * c)}`];
  const hint = `Think of ${a} groups of ${c}. You can skip-count, or use a fact you know and add one more group.`;
  if (chance(0.3)) {
    const shape = SHAPES.find(s => s[2] === c) || SHAPES.find(s => s[2] === a);
    if (shape) { const n = shape[2] === c ? a : c; return { q: `A ${shape[0]} has ${b(shape[2])} ${shape[1]}. How many ${shape[1]} do ${b(n)} of them have altogether?`, type: "num", ans: a * c, hint, steps }; }
    return { q: `A specimen tray has ${b(a)} rows with ${b(c)} minerals in each row. How many minerals fit in the tray?`, type: "num", ans: a * c, hint, steps };
  }
  return { q: eq(`${a} × ${c} = ?`), type: "num", ans: a * c, hint, steps };
}
function divFact(d, q) {
  const steps = [`Ask: ${d} times what makes ${d * q}?`, `${d} × ${q} = ${d * q}`, `So ${d * q} ÷ ${d} = ${b(q)}`];
  const hint = `Division undoes multiplication. Which number times ${d} makes ${d * q}?`;
  if (chance(0.35)) return { q: `${b(d * q)} tumbled stones are shared equally among ${b(d)} rockhounds. How many stones does each one get?`, type: "num", ans: q, unit: "stones", hint, steps };
  return { q: eq(`${d * q} ÷ ${d} = ?`), type: "num", ans: q, hint, steps };
}
function splitTimes(a, c, vertical) {
  const ds = digitsOf(a), parts = ds.map((d, k) => d * 10 ** (ds.length - 1 - k)).filter(Boolean);
  const p = { type: "num", ans: a * c, q: vertical ? "Multiply." : eq(`${fmt(a)} × ${c} = ?`),
    hint: `Split ${fmt(a)} by place value: ${parts.map(fmt).join(" + ")}. Multiply each part by ${c}, then add.`,
    steps: [...parts.map(x => `${fmt(x)} × ${c} = ${fmt(x * c)}`), `${parts.map(x => fmt(x * c)).join(" + ")} = ${b(fmt(a * c))}`] };
  if (vertical) p.vert = { rows: [a, c], op: "×" };
  else if (chance(0.3)) p.q = `One crate holds ${b(fmt(a))} kg of ore. How many kilograms are in ${b(c)} crates?`;
  return p;
}
skill("md_t_easy", "MD", 1, "Times tables: 2, 3, 4, 5, 10", () => timesFact(ri(2, 10), pick([2, 3, 4, 5, 10])));
skill("md_t_hard", "MD", 2, "Times tables: 6, 7, 8, 9", () => timesFact(ri(3, 9), pick([6, 7, 8, 9])));
skill("md_t_1112", "MD", 3, "Times tables: 11 and 12", () => timesFact(ri(3, 12), pick([11, 12])));
skill("md_div_easy", "MD", 3, "Division facts: ÷ 2, 3, 4, 5", () => divFact(pick([2, 3, 4, 5]), ri(2, 10)));
skill("md_div_hard", "MD", 4, "Division facts: ÷ 6 to 12", () => divFact(ri(6, 12), ri(3, 12)));
skill("md_tens", "MD", 4, "Multiply by tens and hundreds", () => {
  const a = ri(2, 9), c = ri(2, 9), za = pick([10, 100]), zc = chance(0.3) ? 10 : 1;
  return { q: eq(`${fmt(a * za)} × ${fmt(c * zc)} = ?`), type: "num", ans: a * za * c * zc,
    hint: `First do ${a} × ${c}. Then count the zeros and put them back on the end.`,
    steps: [`${a} × ${c} = ${a * c}`, `There ${String(za * zc).length - 1 === 1 ? "is 1 zero" : `are ${String(za * zc).length - 1} zeros`} to put back.`, `${b(fmt(a * za * c * zc))}`] };
});
skill("md_2x1", "MD", 5, "2-digit × 1-digit", () => splitTimes(until(() => ri(13, 98), v => v % 10 > 1), ri(3, 9), false));
skill("md_3x1", "MD", 6, "3-digit × 1-digit", () => splitTimes(until(() => ri(112, 987), v => v % 10 > 0), ri(3, 9), chance(0.5)));
skill("md_rem", "MD", 6, "Division with remainders", () => {
  const d = ri(3, 9), q = ri(3, 11), r = ri(1, d - 1), a = d * q + r;
  return { q: `${b(a)} crystals are packed into boxes of ${b(d)}.<br>How many <b>full boxes</b>, and how many crystals are <b>left over</b>?`, type: "rem", ans: { q, r }, labels: ["full boxes", "left over"],
    hint: `Find the biggest number in the ${d} times table that is not more than ${a}.`,
    steps: [`${d} × ${q} = ${d * q} — that fits. ${d} × ${q + 1} = ${d * (q + 1)} is too many.`, `${a} − ${d * q} = ${r} left over.`, `${b(q)} full boxes, ${b(r)} left over`] };
});
skill("md_4x1", "MD", 7, "4-digit × 1-digit", () => splitTimes(until(() => ri(1112, 4987), v => v % 10 > 0), ri(2, 8), true));
skill("md_2d1", "MD", 7, "2-digit ÷ 1-digit", () => {
  const d = ri(2, 8), q = until(() => ri(11, 49), v => v * d < 100 && v % 10 !== 0), a = d * q;
  return { q: chance(0.4) ? `A ${b(a)}-centimeter drill core is cut into ${b(d)} equal pieces. How long is each piece?` : eq(`${a} ÷ ${d} = ?`), type: "num", ans: q,
    hint: `Start with tens: how many groups of ${d} fit in ${a} if you take 10 groups at a time?`, steps: chunkDivide(a, d) };
});
skill("md_2x2", "MD", 8, "2-digit × 2-digit", () => {
  const a = ri(12, 49), c = until(() => ri(12, 39), v => v % 10 > 0), ct = c - c % 10, cu = c % 10;
  return { q: chance(0.4) ? `A mineral shop has ${b(a)} shelves with ${b(c)} specimens on each shelf. How many specimens altogether?` : eq(`${a} × ${c} = ?`), type: "num", ans: a * c,
    hint: `Split ${c} into ${ct} and ${cu}. Do ${a} × ${ct}, then ${a} × ${cu}, and add them.`,
    steps: [`${a} × ${ct} = ${fmt(a * ct)}`, `${a} × ${cu} = ${a * cu}`, `${fmt(a * ct)} + ${a * cu} = ${b(fmt(a * c))}`] };
});
skill("md_3d1", "MD", 9, "3-digit ÷ 1-digit", () => {
  const d = ri(3, 9), q = until(() => ri(24, 199), v => v * d > 120 && v * d < 1000), a = d * q;
  return { q: chance(0.4) ? `${b(a)} kg of gravel is shared equally among ${b(d)} trucks. How many kilograms does each truck carry?` : eq(`${a} ÷ ${d} = ?`), type: "num", ans: q,
    hint: `Take away big easy chunks: ${d} × 100, or ${d} × 10, as many times as will fit.`, steps: chunkDivide(a, d) };
});
skill("md_ops", "MD", 9, "Order of operations", () => {
  const a = ri(3, 20), c = ri(2, 9), d = ri(2, 9), minus = chance(0.4) && a > 0;
  const big = c * d + ri(5, 30);
  return minus
    ? { q: eq(`${big} − ${c} × ${d} = ?`), type: "num", ans: big - c * d, hint: "Multiplication goes first, even when it is written second!", steps: [`First multiply: ${c} × ${d} = ${c * d}`, `Then subtract: ${big} − ${c * d} = ${b(big - c * d)}`] }
    : { q: eq(`${a} + ${c} × ${d} = ?`), type: "num", ans: a + c * d, hint: "Multiplication goes first, even when it is written second!", steps: [`First multiply: ${c} × ${d} = ${c * d}`, `Then add: ${a} + ${c * d} = ${b(a + c * d)}`] };
});
skill("md_3d1r", "MD", 10, "3-digit ÷ 1-digit with a remainder", () => {
  const d = ri(3, 9), q = ri(24, 110), r = ri(1, d - 1), a = d * q + r;
  return { q: `A tumbler polishes ${b(d)} stones at a time. There are ${b(a)} stones to polish.<br>How many <b>full loads</b> is that, and how many stones are <b>left over</b>?`, type: "rem", ans: { q, r }, labels: ["full loads", "left over"],
    hint: `Take away big chunks first: ${d} × 10 = ${d * 10}. How many of those fit?`, steps: [...chunkDivide(a, d).slice(0, -1), `${b(q)} full loads, ${b(r)} left over`] };
});
skill("md_paren", "MD", 10, "Parentheses first", () => {
  const a = ri(3, 12), c = ri(2, 9), d = ri(3, 9), e = ri(2, Math.min(20, (a + c) * d - 1));
  return { q: eq(`(${a} + ${c}) × ${d} − ${e} = ?`), type: "num", ans: (a + c) * d - e,
    hint: "Do what is inside the parentheses first. Then multiply. Subtract last.",
    steps: [`Parentheses: ${a} + ${c} = ${a + c}`, `Multiply: ${a + c} × ${d} = ${(a + c) * d}`, `Subtract: ${(a + c) * d} − ${e} = ${b((a + c) * d - e)}`] };
});
skill("md_4d1", "MD", 10, "4-digit ÷ 1-digit", () => {
  const d = ri(3, 8), q = ri(215, 1240), a = d * q;
  return { q: eq(`${fmt(a)} ÷ ${d} = ?`), type: "num", ans: q, hint: `Take away the biggest chunks first: ${d} × 1,000 or ${d} × 100.`, steps: chunkDivide(a, d) };
});

/* ══════════ AL · balance scales & algebra ══════════ */
const rocks = k => Array(k).fill("x");
skill("al_scale1", "AL", 1, "Balance scale: x + a = b", () => {
  const x = ri(2, 12), a = ri(2, 9);
  return { q: "The scale is balanced. How much does the mystery rock <i>x</i> weigh?", vis: balance(["x", a], [x + a]), type: "num", ans: x,
    hint: `Take ${a} off BOTH sides and the scale stays balanced. What is left on the right?`,
    steps: [`Left: x + ${a}. Right: ${x + a}.`, `Take ${a} away from both sides.`, `x = ${x + a} − ${a} = ${b(x)}`] };
});
skill("al_scale2", "AL", 2, "Balance scale: several equal rocks", () => {
  const k = ri(2, 4), x = ri(2, 12);
  return { q: `${k === 2 ? "Both" : "All " + k} mystery rocks weigh the same. How much does <b>one</b> rock weigh?`, vis: balance(rocks(k), [k * x]), type: "num", ans: x,
    hint: `${k} equal rocks share ${k * x} equally. Split ${k * x} into ${k} equal groups.`,
    steps: [`${k} rocks = ${k * x}`, `One rock = ${k * x} ÷ ${k}`, `x = ${b(x)}`] };
});
skill("al_sym_sub", "AL", 2, "Equations: x − a = b", () => {
  const x = ri(8, 20), a = ri(2, 7);
  return { q: `Find <i>x</i>.${eq(`<i>x</i> − ${a} = ${x - a}`)}`, type: "num", ans: x,
    hint: `Some number, take away ${a}, leaves ${x - a}. Put the ${a} back to find where you started.`,
    steps: [`Add ${a} to both sides.`, `x = ${x - a} + ${a} = ${b(x)}`] };
});
skill("al_scale3", "AL", 3, "Balance scale: two steps", () => {
  const k = ri(2, 3), x = ri(2, 9), a = ri(1, 9);
  return { q: `All the mystery rocks weigh the same. How much does <b>one</b> rock weigh?`, vis: balance([...rocks(k), a], [k * x + a]), type: "num", ans: x,
    hint: `Two steps. First take ${a} off both sides. Then share what is left among the ${k} rocks.`,
    steps: [`Take ${a} off both sides: ${k} rocks = ${k * x + a} − ${a} = ${k * x}`, `Share equally: ${k * x} ÷ ${k}`, `x = ${b(x)}`] };
});
skill("al_sym1", "AL", 4, "One-step equations", () => {
  const t = ri(0, 2);
  if (t === 0) { const x = ri(12, 60), a = ri(11, 48); return { q: `Find <i>x</i>.${eq(`<i>x</i> + ${a} = ${x + a}`)}`, type: "num", ans: x, hint: `Take ${a} away from both sides.`, steps: [`x = ${x + a} − ${a}`, `x = ${b(x)}`] }; }
  if (t === 1) { const k = ri(3, 12), x = ri(3, 12); return { q: `Find <i>x</i>.${eq(`${k}<i>x</i> = ${k * x}`)}<small>${k}<i>x</i> means ${k} times <i>x</i>.</small>`, type: "num", ans: x, hint: `${k} equal rocks weigh ${k * x}. Divide both sides by ${k}.`, steps: [`x = ${k * x} ÷ ${k}`, `x = ${b(x)}`] }; }
  const x = ri(30, 90), a = ri(12, 28); return { q: `Find <i>x</i>.${eq(`<i>x</i> − ${a} = ${x - a}`)}`, type: "num", ans: x, hint: `Add ${a} to both sides.`, steps: [`x = ${x - a} + ${a}`, `x = ${b(x)}`] };
});
skill("al_blank", "AL", 4, "Find the missing number", () => {
  const t = ri(0, 2);
  if (t === 0) { const a = ri(3, 12), x = ri(3, 12); return { q: eq(`? × ${a} = ${a * x}`), type: "num", ans: x, hint: `Which number times ${a} makes ${a * x}?`, steps: [`${a * x} ÷ ${a} = ${b(x)}`] }; }
  if (t === 1) { const total = pick([50, 100, 100, 200]), x = ri(13, total - 13); return { q: eq(`${total} − ? = ${total - x}`), type: "num", ans: x, hint: `How far apart are ${total} and ${total - x}?`, steps: [`${total} − ${total - x} = ${b(x)}`] }; }
  const a = ri(3, 9), x = ri(3, 12); return { q: eq(`${a * x} ÷ ? = ${a}`), type: "num", ans: x, hint: `${a * x} split into how many groups gives ${a} in each group?`, steps: [`${a} × ${x} = ${a * x}`, `So the missing number is ${b(x)}`] };
});
skill("al_sym2", "AL", 5, "Two-step equations", () => {
  const k = ri(2, 9), x = ri(2, 12), a = ri(1, 12), plus = chance(0.6) || k * x <= a;
  const r = plus ? k * x + a : k * x - a;
  return { q: `Find <i>x</i>.${eq(`${k}<i>x</i> ${plus ? "+" : "−"} ${a} = ${r}`)}`, type: "num", ans: x,
    hint: `Undo the ${plus ? "+" : "−"} ${a} first, by ${plus ? "taking it away from" : "adding it to"} both sides. Then divide by ${k}.`,
    steps: [`${k}x = ${r} ${plus ? "−" : "+"} ${a} = ${k * x}`, `x = ${k * x} ÷ ${k}`, `x = ${b(x)}`] };
});
skill("al_scale_both", "AL", 6, "Balance scale: rocks on both sides", () => {
  const k2 = ri(1, 2), k1 = k2 + ri(1, 2), x = ri(2, 9), a = ri(1, 6), bb = (k1 - k2) * x + a;
  return { q: "Every mystery rock weighs the same. How much does <b>one</b> rock weigh?", vis: balance([...rocks(k1), a], [...rocks(k2), bb]), type: "num", ans: x,
    hint: `Take ${k2} rock${k2 > 1 ? "s" : ""} off BOTH sides. The scale still balances, and now rocks are only on the left.`,
    steps: [`Take ${k2} rock${k2 > 1 ? "s" : ""} off each side: ${k1 - k2} rock${k1 - k2 > 1 ? "s" : ""} + ${a} = ${bb}`, `Take ${a} off each side: ${k1 - k2} rock${k1 - k2 > 1 ? "s" : ""} = ${bb - a}`, `x = ${bb - a}${k1 - k2 > 1 ? ` ÷ ${k1 - k2}` : ""} = ${b(x)}`] };
});
skill("al_sym_both", "AL", 7, "Equations with x on both sides", () => {
  const k2 = ri(1, 4), k1 = k2 + ri(1, 4), x = ri(2, 12), a = ri(1, 9), bb = (k1 - k2) * x + a;
  return { q: `Find <i>x</i>.${eq(`${k1}<i>x</i> + ${a} = ${k2 === 1 ? "" : k2}<i>x</i> + ${bb}`)}`, type: "num", ans: x,
    hint: `Picture a balance scale. Take ${k2 === 1 ? "one x" : k2 + " x's"} off both sides first.`,
    steps: [`Take ${k2 === 1 ? "" : k2}x from both sides: ${k1 - k2 === 1 ? "" : k1 - k2}x + ${a} = ${bb}`, `Take ${a} from both sides: ${k1 - k2 === 1 ? "" : k1 - k2}x = ${bb - a}`, `x = ${b(x)}`] };
});
skill("al_div", "AL", 7, "Equations with division", () => {
  const d = ri(2, 9), q = ri(2, 12), a = chance(0.5) ? ri(1, 9) : 0;
  return { q: `Find <i>x</i>.${eq(`<i>x</i> ÷ ${d}${a ? ` + ${a}` : ""} = ${q + a}`)}`, type: "num", ans: d * q,
    hint: `${a ? `First take ${a} from both sides. Then: ` : ""}some number split into ${d} equal groups gives ${q} in each. Multiply to undo division.`,
    steps: [...(a ? [`x ÷ ${d} = ${q + a} − ${a} = ${q}`] : []), `x = ${q} × ${d}`, `x = ${b(d * q)}`] };
});
skill("al_paren", "AL", 8, "Equations with parentheses", () => {
  const k = ri(2, 6), x = ri(2, 12), a = ri(1, 9), plus = chance(0.6) || x <= a;
  const inner = plus ? x + a : x - a;
  return { q: `Find <i>x</i>.${eq(`${k}(<i>x</i> ${plus ? "+" : "−"} ${a}) = ${k * inner}`)}<small>${k}( … ) means ${k} times everything in the parentheses.</small>`, type: "num", ans: x,
    hint: `Think of the parentheses as one mystery box. ${k} boxes = ${k * inner}, so what is in one box?`,
    steps: [`One box: ${k * inner} ÷ ${k} = ${inner}`, `So x ${plus ? "+" : "−"} ${a} = ${inner}`, `x = ${inner} ${plus ? "−" : "+"} ${a} = ${b(x)}`] };
});
skill("al_two", "AL", 9, "Two mystery gems", () => {
  const r = ri(3, 12), e = until(() => ri(2, 11), v => v !== r);
  if (chance(0.5)) {
    const big = Math.max(r, e), small = Math.min(r, e);
    return { q: `A ruby and an emerald together weigh ${b(big + small)} carats.<br>The ruby weighs ${b(big - small)} carats <b>more</b> than the emerald.<br>How much does the <b>ruby</b> weigh?`, type: "num", ans: big, unit: "carats",
      hint: `If you take away the extra ${big - small}, the two gems would be equal. What would each weigh then?`,
      steps: [`Take away the extra: ${big + small} − ${big - small} = ${2 * small}`, `Two equal gems: ${2 * small} ÷ 2 = ${small}. That is the emerald.`, `Ruby = ${small} + ${big - small} = ${b(big)}`] };
  }
  return { q: `2 rubies and 1 emerald weigh ${b(2 * r + e)} carats.<br>1 ruby and 1 emerald weigh ${b(r + e)} carats.<br>How much does <b>one ruby</b> weigh?`, type: "num", ans: r, unit: "carats",
    hint: "Compare the two piles. The first pile has exactly one more ruby than the second. How much heavier is it?",
    steps: [`The first pile has one extra ruby.`, `${2 * r + e} − ${r + e} = ${r}`, `One ruby = ${b(r)} carats (and the emerald = ${e})`] };
});
skill("al_machine", "AL", 10, "Find the rule", () => {
  const m = ri(2, 6), c = ri(1, 9), ins = shuffle([1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 3).sort((x, y) => x - y), ask = until(() => ri(5, 12), v => !ins.includes(v));
  const rows = ins.map(i => `<tr><td>${i}</td><td>${m * i + c}</td></tr>`).join("");
  return { q: `A crystal-growing machine follows a secret rule. What comes out when ${b(ask)} goes in?`, vis: `<table class="machine"><tr><th>In</th><th>Out</th></tr>${rows}<tr><td>${ask}</td><td>?</td></tr></table>`, type: "num", ans: m * ask + c,
    hint: "When In goes up by 1, how much does Out go up? That is what the machine multiplies by. Then see what it adds.",
    steps: [`Each time In goes up by 1, Out goes up by ${m}. So the machine multiplies by ${m}…`, `…and then adds ${c}. Check: ${ins[0]} × ${m} + ${c} = ${m * ins[0] + c} ✓`, `${ask} × ${m} + ${c} = ${b(m * ask + c)}`] };
});
skill("al_seq", "AL", 10, "Growing patterns", () => {
  const d = ri(3, 9), first = ri(2, 12), n = pick([10, 12, 15, 20]);
  const seq = [0, 1, 2, 3].map(k => first + d * k);
  return { q: `A stalactite grows in a pattern. Its length each year is:${eq(`${seq.join(", ")}, …`)}How long will it be in year ${b(n)}? <small>(The first number is year 1.)</small>`, type: "num", ans: first + d * (n - 1), unit: "mm",
    hint: `It grows ${d} each year. From year 1 to year ${n} there are ${n - 1} jumps.`,
    steps: [`Each jump is ${d}.`, `Year 1 to year ${n} is ${n - 1} jumps: ${n - 1} × ${d} = ${(n - 1) * d}`, `${first} + ${(n - 1) * d} = ${b(first + d * (n - 1))}`] };
});

/* ══════════ FR · fractions & proportion ══════════ */
skill("fr_shade", "FR", 1, "Name the fraction", () => {
  const n = pick([2, 3, 4, 5, 6, 8]), k = ri(1, n - 1);
  return { q: `A bar of fluorite is cut into equal slices. What <b>fraction</b> of the bar is purple?`, vis: fracBar(k, n), type: "frac", ans: { n: k, d: n },
    hint: "The bottom number counts ALL the equal pieces. The top number counts the purple ones.",
    steps: [`There are ${n} equal pieces altogether — that is the bottom number.`, `${k} ${k === 1 ? "is" : "are"} purple — that is the top number.`, `${frac(k, n)}`] };
});
skill("fr_half", "FR", 1, "Half and quarter of a number", () => {
  const d = pick([2, 2, 4]), q = ri(3, 15), name = d === 2 ? "half" : "a quarter";
  return { q: `You found ${b(d * q)} agates and gave ${b(name)} of them to a friend. How many did you give away?`, type: "num", ans: q, unit: "agates",
    hint: d === 2 ? "Half means split into 2 equal groups." : "A quarter means split into 4 equal groups. You can halve it, then halve it again.",
    steps: d === 2 ? [`${d * q} ÷ 2 = ${b(q)}`] : [`Half of ${d * q} is ${2 * q}.`, `Half of ${2 * q} is ${b(q)}.`] };
});
function fracOf(k, d, q) {
  const total = d * q;
  return { q: `A rock collection has ${b(total)} specimens. ${frac(k, d)} of them are minerals. How many minerals is that?`, type: "num", ans: k * q, unit: "minerals",
    hint: `The bottom number says: split ${total} into ${d} equal groups. The top number says: take ${k} of those groups.`,
    steps: [`Split into ${d} groups: ${total} ÷ ${d} = ${q} in each group.`, ...(k > 1 ? [`Take ${k} groups: ${k} × ${q} = ${b(k * q)}`] : [`One group is ${b(q)}`])] };
}
skill("fr_unit", "FR", 2, "Unit fraction of a set", () => fracOf(1, pick([3, 4, 5, 6, 8, 10]), ri(2, 9)));
skill("fr_nonunit", "FR", 3, "Fraction of a set", () => { const d = pick([3, 4, 5, 6, 8]); return fracOf(ri(2, d - 1), d, ri(2, 9)); });
skill("fr_equiv", "FR", 4, "Equivalent fractions", () => {
  const [n, d] = pick([[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5]]), m = ri(2, 5), top = chance(0.6);
  return { q: `What number makes these fractions equal?${eq(`${frac(n, d)} = ${top ? frac("?", d * m) : frac(n * m, "?")}`)}`, type: "num", ans: top ? n * m : d * m,
    hint: `What was the ${top ? "bottom" : "top"} number multiplied by? Do exactly the same to the ${top ? "top" : "bottom"}.`,
    steps: [`${top ? d : n} × ${m} = ${top ? d * m : n * m}, so everything was multiplied by ${m}.`, `${top ? n : d} × ${m} = ${b(top ? n * m : d * m)}`, `${frac(n, d)} = ${frac(n * m, d * m)}`] };
});
skill("fr_compare", "FR", 4, "Compare simple fractions", () => {
  if (chance(0.5)) { const d = pick([5, 6, 8, 10]), [x, y] = shuffle(Array.from({ length: d - 1 }, (_, k) => k + 1)).slice(0, 2);
    return { q: "Two bars of quartz are each cut into equal pieces. Which fraction of a bar is <b>bigger</b>?", type: "choice", choices: [frac(x, d), frac(y, d)], ans: x > y ? 0 : 1,
      hint: "The pieces are the same size (same bottom number). So more pieces means more.", steps: [`Both are cut into ${d} equal pieces.`, `${Math.max(x, y)} pieces is more than ${Math.min(x, y)} pieces.`, `${frac(Math.max(x, y), d)} is bigger.`] }; }
  const [x, y] = shuffle([2, 3, 4, 5, 6, 8, 10]).slice(0, 2);
  return { q: "Which fraction is <b>bigger</b>?", type: "choice", choices: [frac(1, x), frac(1, y)], ans: x < y ? 0 : 1,
    hint: "Careful! Cutting something into MORE pieces makes each piece SMALLER.", steps: [`${frac(1, x)} is one of ${x} pieces. ${frac(1, y)} is one of ${y} pieces.`, `Fewer pieces means each piece is bigger.`, `${frac(1, Math.min(x, y))} is bigger.`] };
});
skill("fr_addsub", "FR", 5, "Add and subtract fractions (same denominator)", () => {
  const d = pick([5, 6, 7, 8, 9, 10, 12]), plus = chance(0.6);
  const [x, y] = until(() => [ri(1, d - 2), ri(1, d - 2)], v => plus ? v[0] + v[1] < d : v[0] > v[1]);
  const top = plus ? x + y : x - y;
  return { q: eq(`${frac(x, d)} ${plus ? "+" : "−"} ${frac(y, d)} = ?`), type: "frac", ans: { n: top, d },
    hint: `The pieces are all ${nth(d)}, so the bottom number stays ${d}. Just ${plus ? "add" : "subtract"} the top numbers.`,
    steps: [`${x} ${nth(d, x)} ${plus ? "plus" : "minus"} ${y} ${nth(d, y)}`, `${x} ${plus ? "+" : "−"} ${y} = ${top}, and the pieces are still ${nth(d)}.`, `${frac(top, d)}`] };
});
skill("fr_prop", "FR", 6, "Proportions", () => {
  const t = ri(0, 2);
  if (t === 0) { const each = ri(2, 9), n1 = ri(2, 5), n2 = until(() => ri(3, 12), v => v !== n1);
    return { q: `${b(n1)} geodes cost ${b(n1 * each)} coins. At the same price, how much do ${b(n2)} geodes cost?`, type: "num", ans: n2 * each, unit: "coins",
      hint: "First find the price of ONE geode. Then multiply.", steps: [`One geode: ${n1 * each} ÷ ${n1} = ${each} coins`, `${n2} geodes: ${n2} × ${each} = ${b(n2 * each)} coins`] }; }
  if (t === 1) { const g = ri(2, 12);
    return { q: `Gems are weighed in carats. ${b(5)} carats make ${b(1)} gram.<br>How many grams does a ${b(5 * g)}-carat crystal weigh?`, type: "num", ans: g, unit: "grams",
      hint: "Every 5 carats is 1 gram. How many groups of 5 are there?", steps: [`${5 * g} ÷ 5 = ${g} groups of 5 carats`, `Each group is 1 gram: ${b(g)} grams`] }; }
  const scale = ri(2, 9), cm = ri(3, 12);
  return { q: `On a treasure map, ${b(1)} cm stands for ${b(scale)} km. The old mine is ${b(cm)} cm away on the map.<br>How far away is it really?`, type: "num", ans: scale * cm, unit: "km",
    hint: `Every centimeter is ${scale} km. So ${cm} cm is ${cm} groups of ${scale}.`, steps: [`${cm} × ${scale} = ${b(scale * cm)} km`] };
});
skill("fr_simplify", "FR", 7, "Simplest form", () => {
  const [n, d] = pick([[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [2, 5], [3, 5], [1, 6], [5, 6]]), m = ri(2, 6);
  return { q: `Write this fraction in its <b>simplest form</b>.${eq(frac(n * m, d * m))}`, type: "frac", exact: true, ans: { n, d },
    hint: "Find a number that divides BOTH the top and the bottom. Divide both by it. Keep going until nothing else works.",
    steps: [`${n * m} and ${d * m} can both be divided by ${m}.`, `${n * m} ÷ ${m} = ${n} and ${d * m} ÷ ${m} = ${d}`, `${frac(n, d)}`] };
});
skill("fr_pieces", "FR", 7, "Mixed numbers: count the pieces", () => {
  const d = pick([2, 3, 4, 5]), w = ri(1, 4), k = ri(1, d - 1), name = nth(d);
  return { q: `A geologist has ${b(w)} ${frac(k, d)} bars of chalk. If every bar is snapped into ${name}, how many ${b(name)} is that altogether?`, type: "num", ans: w * d + k, unit: name,
    hint: `Each whole bar makes ${d} ${name}. Count the wholes first, then add the extra pieces.`,
    steps: [`${w} whole bar${w > 1 ? "s" : ""} × ${d} = ${w * d} ${name}`, `Plus ${k} more: ${w * d} + ${k} = ${b(w * d + k)} ${name}`] };
});
skill("fr_compare2", "FR", 8, "Compare fractions with different denominators", () => {
  const [[a, c], [x, y]] = until(() => shuffle([[1, 2], [2, 3], [3, 4], [2, 5], [3, 5], [5, 6], [3, 8], [5, 8], [7, 10], [1, 3], [4, 5]]).slice(0, 2), v => v[0][0] * v[1][1] !== v[1][0] * v[0][1] && v[0][1] !== v[1][1]);
  const L = c * y / gcd(c, y);
  return { q: "Which fraction is <b>bigger</b>?", type: "choice", choices: [frac(a, c), frac(x, y)], ans: a * y > x * c ? 0 : 1,
    hint: `Make the pieces the same size. Turn both into ${nth(L)}, then compare the top numbers.`,
    steps: [`${frac(a, c)} = ${frac(a * L / c, L)}`, `${frac(x, y)} = ${frac(x * L / y, L)}`, `${frac(Math.max(a * L / c, x * L / y), L)} is more, so ${a * y > x * c ? frac(a, c) : frac(x, y)} is bigger.`] };
});
skill("fr_add_unlike", "FR", 8, "Add fractions with different denominators", () => {
  const [d1, d2] = pick([[2, 4], [2, 6], [3, 6], [2, 8], [4, 8], [5, 10], [2, 10], [3, 9]]), a = ri(1, d1 - 1) || 1, m = d2 / d1;
  const c = until(() => ri(1, d2 - 1), v => a * m + v < d2);
  return { q: eq(`${frac(a, d1)} + ${frac(c, d2)} = ?`), type: "frac", ans: { n: a * m + c, d: d2 },
    hint: `You cannot add ${nth(d1)} to ${nth(d2)} until the pieces are the same size. Change ${frac(a, d1)} into ${nth(d2)} first.`,
    steps: [`${frac(a, d1)} = ${frac(a * m, d2)} (multiply top and bottom by ${m})`, `${frac(a * m, d2)} + ${frac(c, d2)} = ${frac(a * m + c, d2)}`] };
});
skill("fr_percent", "FR", 9, "Percent of a number", () => {
  const [pc, d, k] = pick([[50, 2, 1], [25, 4, 1], [10, 10, 1], [75, 4, 3], [20, 5, 1]]), q = ri(2, 12) * (d === 10 ? 1 : pick([1, 5, 10])), total = d * q;
  return { q: `A crate has ${b(fmt(total))} rocks. ${b(pc + "%")} of them are granite. How many granite rocks is that?<br><small>Percent means “out of 100.”</small>`, type: "num", ans: k * q, unit: "rocks",
    hint: `${pc}% is the same as ${frac(k, d)}.`,
    steps: [`${pc}% = ${frac(k, d)}`, `${fmt(total)} ÷ ${d} = ${fmt(q)}`, ...(k > 1 ? [`${k} × ${fmt(q)} = ${b(fmt(k * q))}`] : [`So the answer is ${b(fmt(q))}`])] };
});
skill("fr_times", "FR", 9, "Whole number × fraction", () => {
  const d = pick([3, 4, 5]), k = ri(2, d - 1), w = d * ri(1, 4);
  return { q: `Each rock sample weighs ${frac(k, d)} of a kilogram. How much do ${b(w)} samples weigh?`, type: "num", ans: w * k / d, unit: "kg",
    hint: `${w} samples, each with ${k} ${nth(d)}. Count all the pieces, then see how many wholes they make.`,
    steps: [`${w} × ${k} = ${w * k} pieces, each one ${frac(1, d)} kg`, `Every ${d} pieces make 1 whole kilogram: ${w * k} ÷ ${d} = ${b(w * k / d)} kg`] };
});
skill("fr_rate", "FR", 10, "Rates", () => {
  const each = ri(4, 12), t1 = ri(2, 5), t2 = until(() => ri(4, 9), v => v !== t1);
  return { q: `A rock tumbler polishes ${b(each * t1)} stones in ${b(t1)} weeks. At that rate, how many stones will it polish in ${b(t2)} weeks?`, type: "num", ans: each * t2, unit: "stones",
    hint: "Find how many stones it polishes in ONE week first.", steps: [`One week: ${each * t1} ÷ ${t1} = ${each} stones`, `${t2} weeks: ${t2} × ${each} = ${b(each * t2)} stones`] };
});
skill("fr_ratio", "FR", 10, "Ratios", () => {
  const [x, y] = pick([[2, 3], [3, 4], [1, 4], [3, 5], [2, 5], [4, 5]]), m = ri(3, 9);
  return { q: `A recipe for concrete uses ${b(x)} buckets of sand for every ${b(y)} buckets of gravel.<br>If you use ${b(x * m)} buckets of sand, how many buckets of gravel do you need?`, type: "num", ans: y * m, unit: "buckets",
    hint: `How many times bigger is ${x * m} than ${x}? Make the gravel that many times bigger too.`,
    steps: [`${x * m} ÷ ${x} = ${m}, so the recipe is ${m} times bigger.`, `Gravel: ${y} × ${m} = ${b(y * m)} buckets`] };
});
skill("fr_pct_word", "FR", 10, "Percent problems", () => {
  const [what, pc] = pick([["oxygen", 46], ["silicon", 28], ["aluminum", 8], ["iron", 5]]), total = pick([200, 300, 500, 1000]);
  return { q: `Earth's crust is about ${b(pc + "%")} ${what}. In a ${b(fmt(total))} kg boulder of average crust, about how many kilograms are ${what}?`, type: "num", ans: pc * total / 100, unit: "kg",
    hint: `${pc}% means ${pc} out of every 100. How many hundreds are in ${fmt(total)}?`,
    steps: [`${pc} kg out of every 100 kg.`, `${fmt(total)} kg is ${total / 100} hundred${total > 100 ? "s" : ""}.`, `${pc} × ${total / 100} = ${b(fmt(pc * total / 100))} kg`] };
});

// ───────── engine
const SKILL_BY_ID = Object.fromEntries(SKILLS.map(s => [s.id, s]));
export const skillsAt = (strand, level) => SKILLS.filter(s => s.strand === strand && s.level === level);
export const skillName = id => SKILL_BY_ID[id]?.name || id;
export const allSkills = () => SKILLS;

export function makeProblem(strand, level, avoid) {
  let pool = skillsAt(strand, level);
  if (pool.length > 1 && avoid) pool = pool.filter(s => s.id !== avoid);
  return fromSkill(pick(pool));
}
export function regenerate(p) { return fromSkill(SKILL_BY_ID[p.skill]); }
function fromSkill(s) {
  const p = s.gen();
  p.skill = s.id; p.strand = s.strand; p.level = s.level;
  return p;
}

const PRAISE_NEAR = ["So close!", "Almost there!", "Nearly!"];
// input: string for 'num', index for 'choice', {n,d} for 'frac', {q,r} for 'rem'
export function check(p, input) {
  if (p.type === "choice") return { ok: Number(input) === p.ans };
  if (p.type === "frac") {
    const n = Number(input.n), d = Number(input.d);
    if (!d) return { ok: false, msg: "The bottom number cannot be zero." };
    if (n === p.ans.n && d === p.ans.d) return { ok: true };
    const equal = n * p.ans.d === d * p.ans.n;
    if (equal && !p.exact) return { ok: true };
    if (equal) return { ok: false, msg: "That fraction is equal — nice! But it can be made even simpler." };
    if (n === p.ans.d && d === p.ans.n) return { ok: false, msg: "Check which number goes on top and which goes on the bottom." };
    return { ok: false };
  }
  if (p.type === "rem") {
    const q = Number(input.q), r = Number(input.r);
    if (q === p.ans.q && r === p.ans.r) return { ok: true };
    if (q === p.ans.q) return { ok: false, msg: `The ${p.labels[0]} are right! Check the ${p.labels[1]}.` };
    return { ok: false };
  }
  const v = Number(input);
  if (Math.abs(v - p.ans) < 1e-9) return { ok: true };
  const a = String(p.ans), s = String(input);
  if (Number.isInteger(p.ans) && /^\d+$/.test(s) && a.length === s.length && a.length > 1) {
    const wrong = []; for (let i = 0; i < a.length; i++) if (a[i] !== s[i]) wrong.push(a.length - 1 - i);
    if (wrong.length === 1) return { ok: false, msg: `${pick(PRAISE_NEAR)} Every digit is right except the ${PLACES[wrong[0]]} place.` };
    if (wrong.length < a.length && a.length >= 3) return { ok: false, msg: `Some digits are right! Look again at the ${wrong.sort((x, y) => x - y).map(w => PLACES[w]).join(" and ")}.` };
  }
  if (Number.isInteger(p.ans) && p.ans > 20 && Math.abs(v - p.ans) <= 2) return { ok: false, msg: `${pick(PRAISE_NEAR)} You are only ${Math.abs(v - p.ans)} away.` };
  return { ok: false };
}
