import { KINGDOMS, GROUPS, STAGES, SPECIMENS, BY_ID, GROUP_BY_ID, KINGDOM_BY_ID, TOTAL, RARITY, CRYSTAL_SYSTEMS, FINAL_RANK, kingdomOf, isRockLike, hardnessText, hardnessMid } from "./data.js";
import { LESSONS, LESSON_BY_ID } from "./lessons.js";
import { STRANDS, STRAND_IDS, MAX_LEVEL, check, skillsAt, skillName } from "./math.js";
import { crystalSVG, mysteryRock } from "./shapes.js";
import { CREDITS } from "./credits.js";
import * as G from "./store.js";

const $ = (sel, el = document) => el.querySelector(sel);
const view = $("#view");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pad3 = n => String(n).padStart(3, "0");
const photo = id => `img/s/${id}.jpg`, thumb = id => `img/t/${id}.jpg`;
const rar = s => "r" + Math.ceil(s.st / 2);
const stageOf = n => STAGES[Math.min(n, STAGES.length) - 1];
const unlockedStage = () => Math.min(G.stageNow(), STAGES.length);
const lessonOpen = l => l.stage <= unlockedStage();
const unreadLessons = () => LESSONS.filter(l => lessonOpen(l) && !G.S.read[l.id]).length;
const stars = id => { const n = G.S.quiz[id] || 0; return n ? `<span class="stars">${"★".repeat(n)}${"☆".repeat(3 - n)}</span>` : ""; };

// ───────── sound (tiny synth, no audio files)
let ac;
function sfx(name) {
  if (!G.S.set.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    const t = ac.currentTime;
    const tone = (f, at, dur, type = "sine", vol = 0.09) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      o.connect(g).connect(ac.destination); o.start(t + at); o.stop(t + at + dur + 0.02);
    };
    const noise = (at, dur, vol = 0.18) => {
      const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
      const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = buf; g.gain.value = vol;
      src.connect(g).connect(ac.destination); src.start(t + at);
    };
    if (name === "tap") tone(520, 0, 0.05, "triangle", 0.04);
    if (name === "crack") { noise(0, 0.22); tone(120, 0, 0.18, "triangle", 0.2); tone(880, 0.05, 0.12, "sine", 0.05); }
    if (name === "miss") tone(160, 0, 0.16, "sine", 0.1);
    if (name === "found") [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25 + i * 0.11, 0.35, "sine", 0.1));
    if (name === "open") { noise(0, 0.35, 0.25); tone(90, 0, 0.3, "triangle", 0.22); }
    if (name === "star") { tone(880, 0, 0.12); tone(1175, 0.1, 0.2); }
  } catch { /* sound is optional */ }
}

let toastTimer;
function toast(msg) {
  const el = $("#toast"); el.textContent = msg; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

// ───────── router
const routes = { home, dig, found, dex, card, guide, quiz, grown, credits };
function render() {
  const [name, arg] = (location.hash.slice(1) || "home").split("/");
  const fn = routes[name] || home;
  document.body.dataset.route = routes[name] ? name : "home";
  fn(arg);
  document.querySelectorAll("nav.tabs a").forEach(a => a.classList.toggle("on", a.dataset.tab === document.body.dataset.route || (a.dataset.tab === "dex" && name === "card") || (a.dataset.tab === "home" && (name === "dig" || name === "found"))));
  const n = unreadLessons(); const badge = $("#guidebadge"); badge.textContent = n || ""; badge.hidden = !n;
  if (name !== "dig") window.scrollTo(0, 0);
}
function go(r) { if (location.hash.slice(1) === r) render(); else location.hash = r; }
window.addEventListener("hashchange", render);

// ───────── HOME
function welcome() {
  document.body.dataset.route = "welcome";
  view.innerHTML = `<section class="welcome">
    <div class="wrock">${mysteryRock(0, 2)}</div>
    <h1>Rockhound</h1>
    <p class="lead">Crack open mystery rocks. Collect ${TOTAL} real rocks, minerals, gems, and crystals.</p>
    <form id="nameform"><label for="nm">What is your name, rockhound?</label>
      <input id="nm" maxlength="16" autocomplete="off" autocapitalize="words" placeholder="Your first name" required>
      <button class="btn big">Start exploring</button></form>
  </section>`;
}

function home() {
  const S = G.S;
  if (!S.name) return welcome();
  const st = G.stageNow(), done = st > STAGES.length, stage = stageOf(st), found = G.countFound();
  let cta;
  if (done) cta = `<div class="panel center"><h2>🏛️ The collection is complete!</h2><p>You found all ${TOTAL} specimens and earned the rank of <b>${FINAL_RANK}</b>. Visit your collection, earn stars in the Field Test, or re-read the Field Guide.</p></div>`;
  else if (S.box) cta = `<div class="panel center"><h2>Keep cracking!</h2><button class="rockbtn solo" data-go="dig">${mysteryRock(S.box.variant, S.box.i)}</button><p>${S.box.i} of 3 strikes done.</p><button class="btn big" data-go="dig">Pick up the hammer</button></div>`;
  else if (!G.canDig()) cta = `<div class="panel center"><h2>⛺ The dig site is closed for today</h2><p>You cracked ${G.boxesToday()} rocks today. Great work! Come back tomorrow for more. Until then, explore your collection or the Field Guide.</p></div>`;
  else cta = `<h2 class="pickh">Pick a mystery rock to crack!</h2><div class="rocks">${[0, 1, 2].map(v => `<button class="rockbtn" data-act="pick" data-v="${v}" aria-label="Mystery rock ${v + 1}">${mysteryRock(v)}</button>`).join("")}</div><p class="sub center">Three hammer strikes. Each strike is a math problem.</p>`;
  const recent = S.order.slice(0, 6).map(id => BY_ID[id]).filter(Boolean);
  view.innerHTML = `<section class="home">
    <div class="hero">
      <div class="rankrow"><span class="rank">🏅 ${G.rankName()}</span><span class="count">${found} / ${TOTAL}</span></div>
      <h1>Hi, ${esc(S.name)}!</h1>
      <div class="bar"><i style="width:${Math.max(2, 100 * found / TOTAL)}%"></i></div>
      ${done ? "" : `<p class="exp">Expedition ${stage.n}: <b>${stage.name}</b> · ${G.foundIn(st)} of ${G.sizeOf(st)} found<br><span>${stage.blurb}</span></p>`}
    </div>
    ${cta}
    ${recent.length ? `<h3 class="sech">Latest finds</h3><div class="recent">${recent.map(s => `<button class="tile got ${rar(s)}" data-go="card/${s.id}"><img src="${thumb(s.id)}" alt=""><span class="tname">${s.n}</span></button>`).join("")}</div>` : ""}
    <p class="foot"><a data-go="grown">Grown-ups</a> · <a data-go="credits">Photo credits</a></p>
  </section>`;
}

// ───────── DIG
let entry = null, busy = false;
const cur = () => G.S.box.probs[G.S.box.i];
function resetEntry() {
  const p = cur();
  entry = { f: p.type === "frac" ? { n: "", d: "" } : p.type === "rem" ? { q: "", r: "" } : { a: "" }, active: p.type === "frac" ? "n" : p.type === "rem" ? "q" : "a", carries: [] };
}

function vertHTML(p) {
  const cols = Math.max(String(p.ans).length, ...p.vert.rows.map(r => String(r).length));
  const cell = (ch, c, cls = "") => `<span class="vc p${c % 3}${c % 3 === 0 && c > 0 ? " gap" : ""} ${cls}">${ch}</span>`;
  const row = n => { const s = String(n); let out = ""; for (let c = cols - 1; c >= 0; c--) out += cell(c < s.length ? s[s.length - 1 - c] : "", c); return out; };
  let carry = "";
  if (p.vert.op !== "−") { carry = `<div class="vrow"><span class="vop"></span>`; for (let c = cols - 1; c >= 0; c--) carry += c === 0 ? cell("", 0) : `<button class="vc vcarry p${c % 3}${c % 3 === 0 ? " gap" : ""}" data-act="carry" data-c="${c}" aria-label="carry">${entry.carries[c] || ""}</button>`; carry += "</div>"; }
  const typed = entry.f.a; let ans = "";
  for (let c = cols - 1; c >= 0; c--) ans += cell(typed[c] || "", c, "va" + (c === typed.length ? " cur" : ""));
  return `<div class="vert" style="--cols:${cols}">${carry}${p.vert.rows.map((n, i) => `<div class="vrow"><span class="vop">${i === p.vert.rows.length - 1 ? p.vert.op : ""}</span>${row(n)}</div>`).join("")}
    <div class="vline"></div><div class="vrow"><span class="vop"></span>${ans}</div></div>
    <p class="vnote">Type the <b class="pu">units</b> digit first, just like on paper.</p>`;
}

function answerHTML(p) {
  const box = (f, cls = "") => `<button class="ansbox ${cls}${entry.active === f ? " active" : ""}" data-act="field" data-f="${f}">${entry.f[f] || `<span class="hole">?</span>`}</button>`;
  if (p.vert) return vertHTML(p);
  if (p.type === "frac") return `<div class="ansrow"><div class="ansfrac">${box("n", "sm")}<span class="frbar"></span>${box("d", "sm")}</div></div>`;
  if (p.type === "rem") return `<div class="ansrow rem"><label>${box("q", "sm")}<span>${p.labels[0]}</span></label><label>${box("r", "sm")}<span>${p.labels[1]}</span></label></div>`;
  if (p.type === "choice") return "";
  return `<div class="ansrow">${box("a")}${p.unit ? `<span class="unit">${p.unit}</span>` : ""}</div>`;
}

function helpHTML(p, b) {
  if (!b.h) return "";
  const full = b.h >= 3, steps = full ? p.steps : p.steps.slice(0, -1);
  let out = `<div class="help"><p><b>💡 Hint:</b> ${p.hint}</p>`;
  if (b.h >= 2 && steps.length) out += `<ol>${steps.map(s => `<li>${s}</li>`).join("")}</ol>${full ? "" : `<p class="sub">Now you finish it!</p>`}`;
  if (full) out += `<p class="sub">That is how a geologist would work it out. Ready to try a fresh one yourself?</p><button class="btn" data-act="fresh">Try a fresh one ▸</button>`;
  return out + "</div>";
}

function padHTML(p, b) {
  if (b.h >= 3) return `<div class="pad done"></div>`;
  if (p.type === "choice") return `<div class="pad choices">${p.choices.map((c, i) => `<button class="btn choice" data-act="choose" data-i="${i}">${c}</button>`).join("")}</div>`;
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", p.dec ? "." : "", "0", "⌫"];
  return `<div class="pad">${keys.map(k => k ? `<button class="key${k === "⌫" ? " back" : ""}" data-act="key" data-k="${k}">${k}</button>` : `<span></span>`).join("")}
    <button class="btn big check" data-act="check">🔨 Strike!</button></div>`;
}

function dig() {
  const b = G.S.box;
  if (!b) return go("home");
  if (!entry) resetEntry();
  busy = false;
  const p = cur(), sd = STRANDS[p.strand];
  view.innerHTML = `<section class="dig">
    <div class="digtop"><button class="link" data-go="home">‹ Camp</button>
      <div class="strikes">${[0, 1, 2].map(i => `<span class="${i < b.i ? "hit" : i === b.i ? "now" : ""}">🔨</span>`).join("")}</div>
      <span class="chip">${sd.icon} ${sd.name}</span></div>
    <div class="digbody">
      <div class="rockwrap" id="rockwrap">${mysteryRock(b.variant, b.i)}<p class="sub">Strike ${b.i + 1} of 3</p></div>
      <div class="problem">
        <div class="q">${p.q}</div>
        ${p.vis ? `<div class="vis">${p.vis}</div>` : ""}
        <div id="answer"${b.h >= 3 ? " hidden" : ""}>${answerHTML(p)}</div>
        <div id="feedback" class="feedback" aria-live="polite"></div>
        <div id="help">${helpHTML(p, b)}</div>
        ${b.h < 2 ? `<button class="link hintbtn" data-act="hint">${b.h ? "Show me more" : "💡 I'd like a hint"}</button>` : ""}
      </div>
      <div id="pad">${padHTML(p, b)}</div>
    </div></section>`;
}
const paintAnswer = () => { $("#answer").innerHTML = answerHTML(cur()); };
const say = (html, cls = "") => { const f = $("#feedback"); if (f) { f.className = "feedback " + cls; f.innerHTML = html; } };

function pressKey(k) {
  if (busy || !G.S.box || G.S.box.h >= 3) return;
  const p = cur(); if (p.type === "choice") return;
  let v = entry.f[entry.active];
  if (k === "⌫") v = v.slice(0, -1);
  else if (k === ".") { if (!p.dec || v.includes(".")) return; v = (v || "0") + "."; }
  else if (v.length < 9) v += k;
  entry.f[entry.active] = v;
  sfx("tap"); say(""); paintAnswer();
}

const MISS = ["Not yet — the rock held. Give it another tap!", "Tough rock! Take another look and try again.", "Hmm, not quite. Geologists always test twice.", "The rock is still holding. Check it once more."];
const HIT = ["Crack!", "Solid strike!", "Great hit!", "That's it!", "Right on the mark!"];

function submit(choice) {
  if (busy || !G.S.box) return;
  const b = G.S.box, p = cur(); let input;
  const nudge = () => { const a = $("#answer"); a.classList.remove("nudge"); void a.offsetWidth; a.classList.add("nudge"); };
  if (p.type === "choice") input = choice;
  else if (p.type === "frac") { if (!entry.f.n || !entry.f.d) return nudge(); input = entry.f; }
  else if (p.type === "rem") { if (!entry.f.q || !entry.f.r) return nudge(); input = entry.f; }
  else { if (!entry.f.a || entry.f.a === ".") return nudge(); input = p.vert ? entry.f.a.split("").reverse().join("") : entry.f.a; }
  b.tries++;
  const res = check(p, input);
  if (res.ok) return strike();
  sfx("miss");
  b.miss = (b.miss || 0) + 1;
  b.h = Math.max(b.h, p.type === "choice" ? 3 : Math.min(b.miss, 3));
  G.save();
  const wrap = $("#rockwrap"); wrap.classList.remove("clink"); void wrap.offsetWidth; wrap.classList.add("clink");
  $("#help").innerHTML = helpHTML(p, b);
  if (b.h >= 3) { $("#pad").innerHTML = padHTML(p, b); $("#answer").hidden = true; const hb = $(".hintbtn"); if (hb) hb.remove(); say("Let's look at this one together.", "soft"); }
  else { say(res.msg || pick(MISS), "soft"); const hb = $(".hintbtn"); if (hb) { if (b.h >= 2) hb.remove(); else hb.textContent = "Show me more"; } }
}

function strike() {
  const b = G.S.box, p = cur();
  busy = true;
  if (G.recordSolve(p, b.tries) === "up") b.ups.push(p.strand);
  b.i++; b.tries = 0; b.miss = 0; b.h = 0; entry = null; G.save();
  sfx("crack");
  say(`<b>✓ ${pick(HIT)}</b>`, "good");
  const wrap = $("#rockwrap");
  wrap.innerHTML = mysteryRock(b.variant, Math.min(b.i, 3)) + `<p class="sub">${b.i < 3 ? "The rock is cracking…" : "It is breaking open!"}</p>`;
  wrap.classList.add("struck");
  if (b.i >= 3) setTimeout(() => { sfx("open"); wrap.classList.add("burst"); }, 500);
  setTimeout(() => { if (b.i >= 3) { G.award(); sfx("found"); go("found"); } else dig(); }, b.i >= 3 ? 1300 : 1050);
}

// ───────── FOUND (reveal)
function found() {
  const L = G.S.last;
  if (!L) return go("home");
  const s = BY_ID[L.id], g = GROUP_BY_ID[s.g], k = KINGDOM_BY_ID[g.k];
  const first = (s.txt.match(/^.*?[.!?](?=\s|$)/) || [s.txt])[0];
  let extra = "";
  if (L.rankUp) {
    const done = L.rankUp > STAGES.length, les = LESSONS.find(l => l.stage === L.rankUp);
    extra += `<div class="banner gold"><b>🏅 Expedition complete!</b><br>New rank: <b>${done ? FINAL_RANK : STAGES[L.rankUp - 1].rank}</b>${done ? "" : `<br>Next stop: Expedition ${L.rankUp}, <b>${STAGES[L.rankUp - 1].name}</b>`}${les ? `<br>📖 New Field Guide chapter: <a data-go="guide/${les.id}">${les.title}</a>` : ""}</div>`;
  }
  if (L.ups && L.ups.length) extra += `<div class="banner teal">⭐ Math power up: ${L.ups.map(u => `<b>${STRANDS[u].name}</b> is now level ${G.S.math[u].lvl}`).join(" · ")}</div>`;
  view.innerHTML = `<section class="found">
    <div class="foundcard ${rar(s)}">
      <div class="rays"></div>
      <div class="newtag">${L.lucky ? "🍀 Lucky find!" : "New specimen!"}</div>
      <img src="${photo(s.id)}" alt="${esc(s.n)}">
      <h1><small>#${pad3(s.num)}</small> ${s.n}</h1>
      <div class="chips"><span class="chip ${rar(s)}">${RARITY[s.st]}</span><span class="chip k-${k.id}">${k.icon} ${g.cls}</span>${s.gem ? `<span class="chip gem">💎 Gem</span>` : ""}</div>
      <p>${first}</p>
    </div>
    ${extra}
    <div class="row"><button class="btn big" data-go="card/${s.id}">📖 Read its field card</button>
      ${G.stageNow() > STAGES.length ? "" : G.canDig() ? `<button class="btn big alt" data-act="again">⛏️ Crack another rock</button>` : `<button class="btn big alt" data-go="home">Back to camp</button>`}</div>
  </section>`;
}

// ───────── COLLECTION
let lens = "family";
const LENSES = [["family", "Families"], ["hardness", "Hardness"], ["crystal", "Crystal shape"], ["gems", "Gems"]];
function tile(s) {
  return G.has(s.id)
    ? `<button class="tile got ${rar(s)}" data-go="card/${s.id}"><img loading="lazy" src="${thumb(s.id)}" alt=""><span class="tnum">#${pad3(s.num)}</span><span class="tname">${s.n}</span>${stars(s.id)}</button>`
    : `<button class="tile ${rar(s)}" data-act="locked" data-id="${s.id}" aria-label="Not found yet"><span class="tq">?</span><span class="tnum">#${pad3(s.num)}</span></button>`;
}
const grid = list => `<div class="grid">${list.map(tile).join("")}</div>`;
const tally = list => `<span class="tally">${list.filter(s => G.has(s.id)).length}/${list.length}</span>`;

function dex() {
  let body = "";
  if (lens === "family") {
    for (const k of KINGDOMS) {
      const ks = SPECIMENS.filter(s => kingdomOf(s) === k.id);
      body += `<div class="kingdom k-${k.id}"><h2>${k.icon} ${k.name} ${tally(ks)}</h2><p>${k.rule}</p><p class="sub">${k.sort}</p></div>`;
      let lastCls = "";
      for (const g of GROUPS.filter(g => g.k === k.id)) {
        const multi = GROUPS.filter(x => x.cls === g.cls).length > 1;
        if (multi && g.cls !== lastCls) body += `<h3 class="cls">${g.cls} ${tally(SPECIMENS.filter(s => GROUP_BY_ID[s.g].cls === g.cls))}</h3>`;
        lastCls = g.cls;
        const list = SPECIMENS.filter(s => s.g === g.id);
        body += `<div class="group"><h4>${g.name}${g.sci ? ` <i>(${g.sci})</i>` : ""} ${tally(list)}</h4><p class="sub">${g.rule}</p>${grid(list)}</div>`;
      }
    }
  } else if (lens === "hardness") {
    const ref = ["", "Talc", "Gypsum", "Calcite", "Fluorite", "Apatite", "Orthoclase", "Quartz", "Topaz", "Corundum", "Diamond"];
    body += `<div class="kingdom"><h2>The Mohs hardness ladder</h2><p>A harder mineral scratches a softer one. Each step is named after its reference mineral.</p></div>`;
    for (let h = 10; h >= 1; h--) {
      const list = SPECIMENS.filter(s => s.h && Math.floor(hardnessMid(s)) === h).sort((a, c) => hardnessMid(c) - hardnessMid(a));
      if (list.length) body += `<div class="group"><h4><span class="hnum">${h}</span> As hard as ${ref[h].toLowerCase()} ${tally(list)}</h4>${grid(list)}</div>`;
    }
    const rest = SPECIMENS.filter(s => !s.h);
    body += `<div class="group"><h4>Rocks and space rocks ${tally(rest)}</h4><p class="sub">A rock is a mixture, so it has no single hardness. Each mineral grain inside has its own.</p>${grid(rest)}</div>`;
  } else if (lens === "crystal") {
    body += `<div class="kingdom"><h2>The seven crystal systems</h2><p>Every mineral's atoms stack in exactly one of seven patterns.</p></div>`;
    for (const c of CRYSTAL_SYSTEMS) {
      const list = SPECIMENS.filter(s => s.cs === c.id);
      body += `<div class="group"><h4 class="withsvg">${crystalSVG(c.id, 44)} ${c.name} ${tally(list)}</h4><p class="sub">${c.note}</p>${grid(list)}</div>`;
    }
    const none = SPECIMENS.filter(s => s.cs === "none"), rest = SPECIMENS.filter(s => !s.cs);
    body += `<div class="group"><h4>No crystal pattern ${tally(none)}</h4><p class="sub">Mineraloids: their atoms are jumbled, or they were made by living things.</p>${grid(none)}</div>
      <div class="group"><h4>Rocks and space rocks ${tally(rest)}</h4><p class="sub">Mixtures of many crystals of different kinds.</p>${grid(rest)}</div>`;
  } else {
    body += `<div class="kingdom"><h2>💎 Gems</h2><p>A gem is not a separate kind of thing. It is any specimen beautiful, tough, and rare enough to wear. Most gems are minerals — but not all!</p></div>`;
    for (const k of KINGDOMS) {
      const list = SPECIMENS.filter(s => s.gem && kingdomOf(s) === k.id);
      if (list.length) body += `<div class="group"><h4>Gems that are ${k.name.toLowerCase()} ${tally(list)}</h4>${grid(list)}</div>`;
    }
  }
  view.innerHTML = `<section class="dex"><div class="dexhead"><h1>My Collection</h1><span class="count">${G.countFound()} / ${TOTAL}</span></div>
    <div class="lens">${LENSES.map(([id, n]) => `<button class="${lens === id ? "on" : ""}" data-act="lens" data-l="${id}">${n}</button>`).join("")}</div>${body}</section>`;
}

// ───────── FIELD CARD
function mohsBar(s) {
  let cells = "";
  for (let i = 1; i <= 10; i++) cells += `<i class="${i >= Math.floor(s.h[0]) && i <= Math.ceil(s.h[1]) ? "on" : ""}">${i}</i>`;
  const h = hardnessMid(s);
  const note = h >= 10 ? "The hardest of all. Only another diamond can scratch it." : h >= 7 ? "Scratches glass and steel easily." : h >= 5.5 ? "Hard enough to scratch glass." : h >= 3.5 ? "A steel nail scratches it, but a copper coin cannot." : h >= 2.5 ? "A copper coin scratches it, but your fingernail cannot." : "Soft enough to scratch with your fingernail.";
  return `<div class="mohsbar">${cells}</div><small>${note}</small>`;
}
function card(id) {
  const s = BY_ID[id];
  if (!s || !G.has(id)) return go("dex");
  const g = GROUP_BY_ID[s.g], k = KINGDOM_BY_ID[g.k], cr = CREDITS[id], rocky = isRockLike(s);
  const cs = CRYSTAL_SYSTEMS.find(c => c.id === s.cs);
  const row = (label, val) => val ? `<tr><th>${label}</th><td>${val}</td></tr>` : "";
  const clues = rocky
    ? row("Texture", s.tex) + row("Made of", s.made) + row("How it forms", s.how)
    : row("Hardness", `<b>${hardnessText(s)}</b> on the Mohs scale${mohsBar(s)}`) + row("Luster", s.lu) + row("Streak", s.sk)
      + row("Crystal system", cs ? `<span class="csrow">${crystalSVG(s.cs, 46)}<span><b>${cs.name}</b><br><small>${cs.note}</small></span></span>` : `<span class="csrow">${crystalSVG("none", 46)}<span><b>None</b><br><small>No repeating pattern inside, so it is a mineraloid.</small></span></span>`)
      + row("Heft", `<b>${s.sg}</b> times as heavy as water`) + row("Recipe", `<span class="formula">${s.f}</span><br><small>${s.made}</small>`);
  const mine = SPECIMENS.filter(x => G.has(x.id)), at = mine.indexOf(s), prev = mine[at - 1], next = mine[at + 1];
  const kids = SPECIMENS.filter(x => x.of === s.id && G.has(x.id));
  view.innerHTML = `<section class="cardview">
    <div class="cardnav"><button class="link" data-go="dex">‹ Collection</button><span>${prev ? `<button class="link" data-go="card/${prev.id}">‹ Prev</button>` : ""}${next ? `<button class="link" data-go="card/${next.id}">Next ›</button>` : ""}</span></div>
    <article class="fieldcard ${rar(s)}">
      <img class="hero" src="${photo(s.id)}" alt="${esc(s.n)}">
      <div class="fc">
        <div class="fnum">#${pad3(s.num)} ${stars(s.id)}</div>
        <h1>${s.n}</h1>
        <div class="chips"><span class="chip ${rar(s)}">${RARITY[s.st]}</span>${s.gem ? `<span class="chip gem">💎 Gem</span>` : ""}<span class="chip">Found in: ${stageOf(s.st).name}</span></div>
        <p class="crumb k-${k.id}">${k.icon} ${k.name} › ${g.cls}${g.cls !== g.name ? ` › ${g.name}` : ""}</p>
        <p class="rule">${g.rule}</p>
        ${s.of ? `<p class="variety">A variety of ${G.has(s.of) ? `<a data-go="card/${s.of}">${BY_ID[s.of].n}</a>` : `<b>${BY_ID[s.of].n}</b>`} — the same mineral in a special color or form.</p>` : ""}
        ${kids.length ? `<p class="variety">Varieties in your collection: ${kids.map(x => `<a data-go="card/${x.id}">${x.n}</a>`).join(", ")}</p>` : ""}
        <p class="story">${s.txt}</p>
        <div class="wow"><b>Wow!</b> ${s.wow}</div>
        <h3>${rocky ? "Rock facts" : "Detective clues"}</h3>
        <table class="clues">${clues}</table>
        <table class="clues">${row("Used for", s.use)}${row("Where it is found", s.loc)}</table>
        ${cr ? `<p class="credit">Photo: ${esc(cr.artist)} · ${esc(cr.license)} · <a href="${esc(cr.page)}" target="_blank" rel="noopener">Wikimedia Commons</a></p>` : ""}
      </div>
    </article></section>`;
}

// ───────── FIELD GUIDE
function guide(id) {
  const l = LESSON_BY_ID[id];
  if (l && lessonOpen(l)) {
    if (!G.S.read[l.id]) { G.S.read[l.id] = 1; G.save(); }
    const open = LESSONS.filter(lessonOpen), at = open.indexOf(l), next = open[at + 1];
    view.innerHTML = `<section class="lesson"><div class="cardnav"><button class="link" data-go="guide">‹ Field Guide</button></div>
      <article class="paper"><div class="licon">${l.icon}</div><h1>${l.title}</h1>${l.body}
      ${next ? `<button class="btn" data-go="guide/${next.id}">Next chapter: ${next.title} ▸</button>` : ""}</article></section>`;
    return;
  }
  view.innerHTML = `<section class="guide"><h1>Field Guide</h1><p class="sub">A new chapter unlocks each time you reach a new expedition.</p>
    <div class="chapters">${LESSONS.map((x, i) => lessonOpen(x)
      ? `<button class="chapter" data-go="guide/${x.id}"><span class="licon">${x.icon}</span><span><small>Chapter ${i + 1}</small><b>${x.title}</b></span>${G.S.read[x.id] ? `<span class="tick">✓</span>` : `<span class="new">NEW</span>`}</button>`
      : `<div class="chapter locked"><span class="licon">🔒</span><span><small>Chapter ${i + 1}</small><b>${x.title}</b><i>Unlocks at Expedition ${x.stage}: ${STAGES[x.stage - 1].name}</i></span></div>`).join("")}</div></section>`;
}

// ───────── FIELD TEST (rock knowledge quiz — earns stars, never blocks anything)
let qz = null;
function buildQuiz() {
  const mine = SPECIMENS.filter(s => G.has(s.id));
  const targets = shuffle(mine).sort((a, c) => (G.S.quiz[a.id] || 0) - (G.S.quiz[c.id] || 0)).slice(0, 5);
  const qs = targets.map(s => {
    const k = kingdomOf(s), kinds = ["name", "group"];
    if (s.h && mine.some(o => o.h && Math.abs(hardnessMid(o) - hardnessMid(s)) >= 1)) kinds.push("harder");
    if (k === "rocks") kinds.push("rocktype");
    const kind = pick(kinds);
    if (kind === "name") {
      const others = shuffle(SPECIMENS.filter(o => o.id !== s.id && kingdomOf(o) === k && o.of !== s.id && s.of !== o.id)).slice(0, 3);
      const ch = shuffle([s, ...others]);
      return { id: s.id, img: s.id, q: "Which specimen is this?", choices: ch.map(o => o.n), ans: ch.indexOf(s), why: `It is ${s.n}.` };
    }
    if (kind === "group") {
      const g = GROUP_BY_ID[s.g], pool = GROUPS.filter((o, i, a) => o.cls !== g.cls && a.findIndex(x => x.cls === o.cls) === i);
      const others = shuffle(pool.filter(o => o.k === g.k)).concat(shuffle(pool.filter(o => o.k !== g.k))).slice(0, 3);
      const ch = shuffle([g, ...others]);
      return { id: s.id, img: s.id, q: `${s.n} belongs to which family?`, choices: ch.map(o => o.cls), ans: ch.indexOf(g), why: `${s.n}: ${g.cls}. ${g.rule}` };
    }
    if (kind === "harder") {
      const o = pick(mine.filter(o => o.h && Math.abs(hardnessMid(o) - hardnessMid(s)) >= 1)), ch = shuffle([s, o]);
      const win = hardnessMid(s) > hardnessMid(o) ? s : o;
      return { id: s.id, q: `Which one is harder — which could scratch the other?`, choices: ch.map(x => x.n), ans: ch.indexOf(win), why: `${s.n} is ${hardnessText(s)} and ${o.n} is ${hardnessText(o)} on the Mohs scale.` };
    }
    const types = ["Igneous Rocks", "Sedimentary Rocks", "Metamorphic Rocks"], g = GROUP_BY_ID[s.g];
    return { id: s.id, img: s.id, q: `How did ${s.n} form?`, choices: ["Melted rock cooled (igneous)", "Layers piled up (sedimentary)", "Squeezed and baked (metamorphic)"], ans: types.indexOf(g.cls), why: s.how };
  });
  qz = { qs, i: 0, earned: 0, missed: false, answered: false };
}
function quiz() {
  const have = G.countFound();
  if (have < 5) { view.innerHTML = `<section class="guide"><h1>Field Test</h1><div class="panel center"><p>Collect at least <b>5 specimens</b> to open the Field Test.</p><p>You have ${have} so far.</p><button class="btn" data-go="home">Go crack some rocks</button></div></section>`; return; }
  if (!qz) { view.innerHTML = `<section class="guide"><h1>Field Test</h1><div class="panel center"><p>How well do you know your collection? Answer five questions about your own specimens.</p><p>Each one you get right on the first try earns that specimen a ★ (up to three).</p><button class="btn big" data-act="quizstart">Start the Field Test</button></div></section>`; return; }
  if (qz.i >= qz.qs.length) {
    view.innerHTML = `<section class="guide"><h1>Field Test</h1><div class="panel center"><h2>${qz.earned ? `You earned ${qz.earned} ★` : "Good practice!"}</h2><p>${qz.earned >= 4 ? "Outstanding fieldwork, geologist." : "Every test makes your memory stronger."}</p><div class="row"><button class="btn big" data-act="quizstart">Another round</button><button class="btn big alt" data-go="dex">See my collection</button></div></div></section>`;
    return;
  }
  const q = qz.qs[qz.i];
  view.innerHTML = `<section class="guide quiz"><h1>Field Test <small>${qz.i + 1} of ${qz.qs.length}</small></h1>
    <div class="paper">${q.img ? `<img class="qimg" src="${photo(q.img)}" alt="" onerror="this.remove()">` : ""}<p class="q">${q.q}</p>
    <div class="choices">${q.choices.map((c, i) => `<button class="btn choice" data-act="quizpick" data-i="${i}">${c}</button>`).join("")}</div>
    <div id="feedback" class="feedback"></div></div></section>`;
}
function quizPick(i, el) {
  const q = qz.qs[qz.i];
  if (qz.answered) return;
  if (i !== q.ans) { qz.missed = true; el.disabled = true; el.classList.add("no"); sfx("miss"); say("Not that one — look again.", "soft"); return; }
  qz.answered = true; el.classList.add("yes");
  if (!qz.missed && (G.S.quiz[q.id] || 0) < 3) { G.S.quiz[q.id] = (G.S.quiz[q.id] || 0) + 1; qz.earned++; G.save(); sfx("star"); say(`<b>✓ Yes! ★ for ${BY_ID[q.id].n}.</b><br>${q.why}<br><button class="btn" data-act="quiznext">Next ▸</button>`, "good"); }
  else { sfx("tap"); say(`<b>✓ That's right.</b><br>${q.why}<br><button class="btn" data-act="quiznext">Next ▸</button>`, "good"); }
}

// ───────── GROWN-UPS
let grownOK = false;
function grown() {
  const S = G.S;
  if (!grownOK) {
    view.innerHTML = `<section class="guide"><h1>Grown-ups</h1><form id="pinform" class="panel center">
      <p>${S.pin ? "Enter your PIN." : "Choose a 4-digit PIN so settings stay with a grown-up."}</p>
      <input id="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required>
      <button class="btn">${S.pin ? "Unlock" : "Set PIN"}</button><div id="feedback" class="feedback"></div></form></section>`;
    return;
  }
  const total = Object.values(S.stats).reduce((a, x) => ({ a: a.a + x.a, f: a.f + x.f }), { a: 0, f: 0 });
  const rows = STRAND_IDS.map(id => {
    const m = S.math[id];
    const agg = S.log.filter(l => l.s === id), ft = agg.filter(l => l.n === 1).length;
    return `<tr><td><b>${STRANDS[id].icon} ${STRANDS[id].long}</b><br><small>Working on: ${skillsAt(id, m.lvl).map(s => s.name).join("; ")}</small></td>
      <td class="lv"><button class="key sm" data-act="lvl" data-s="${id}" data-d="-1">−</button><b>${m.lvl}</b><button class="key sm" data-act="lvl" data-s="${id}" data-d="1">+</button><br><small>${"●".repeat(m.m)}${"○".repeat(G.MASTERY_GOAL - m.m)}</small></td>
      <td>${agg.length ? Math.round(100 * ft / agg.length) + "%" : "—"}<br><small>${agg.length} recent</small></td></tr>`;
  }).join("");
  const label = n => n === 1 ? "✓ first try" : n === 2 ? "2 tries" : "needed the worked example";
  view.innerHTML = `<section class="guide grown"><h1>Grown-ups</h1>
    <div class="paper">
      <h3>Progress</h3>
      <p><b>${G.countFound()}</b> of ${TOTAL} specimens · Expedition ${Math.min(G.stageNow(), STAGES.length)} of ${STAGES.length} · <b>${S.solved}</b> problems solved · ${total.a ? Math.round(100 * total.f / total.a) : 0}% right on the first try · ${G.boxesToday()} rocks today</p>
      <h3>Math levels</h3>
      <p class="sub">Each strand has ${MAX_LEVEL} levels. ${G.MASTERY_GOAL} first-try solves at the current level move it up one (dots show progress); two problems in a row that need the worked example move it down one. Automatic levelling is capped at expedition + 2, currently level ${G.levelCap()}, so difficulty climbs with the collection. Use − and + to place him by hand.</p>
      <table class="gtable"><tr><th>Strand</th><th>Level</th><th>First try</th></tr>${rows}</table>
      <h3>Recent problems</h3>
      ${S.log.length ? `<table class="gtable small">${S.log.slice(0, 15).map(l => `<tr><td>${STRANDS[l.s].icon} L${l.l}</td><td>${skillName(l.k)}</td><td>${label(l.n)}</td></tr>`).join("")}</table>` : `<p class="sub">Nothing yet.</p>`}
      <h3>Settings</h3>
      <form id="setform" class="settings">
        <label>Explorer's name <input id="setname" maxlength="16" value="${esc(S.name)}"></label>
        <label>Mystery rocks per day <select id="setlimit">${[[0, "No limit"], [2, "2"], [3, "3"], [5, "5"], [8, "8"], [10, "10"]].map(([v, n]) => `<option value="${v}"${S.set.limit === v ? " selected" : ""}>${n}</option>`).join("")}</select></label>
        <label class="check"><input id="setsound" type="checkbox"${S.set.sound ? " checked" : ""}> Sound effects</label>
        <button class="btn">Save settings</button>
      </form>
      <h3>Start over</h3>
      <p class="sub">Erases the collection and math history on this device. Name, PIN, and settings are kept.</p>
      <button class="btn danger" data-act="reset">Reset all progress</button>
    </div></section>`;
}

// ───────── CREDITS
function credits() {
  view.innerHTML = `<section class="guide"><div class="cardnav"><button class="link" data-go="home">‹ Camp</button></div><h1>Photo credits</h1>
    <div class="paper"><p>Every photo is a real specimen, from Wikimedia Commons. Thank you to the photographers and museums who share their work.</p>
    <table class="gtable small">${SPECIMENS.map(s => { const c = CREDITS[s.id]; return c ? `<tr><td>${s.n}</td><td>${esc(c.artist)}</td><td><a href="${esc(c.page)}" target="_blank" rel="noopener">${esc(c.license)}</a></td></tr>` : ""; }).join("")}</table></div></section>`;
}

// ───────── events
document.addEventListener("click", e => {
  const a = e.target.closest("[data-go],[data-act]");
  if (!a) return;
  if (a.dataset.go) { e.preventDefault(); if (a.dataset.go === "grown") grownOK = false; return go(a.dataset.go); }
  const d = a.dataset;
  switch (d.act) {
    case "pick": case "again": if (!G.canDig()) return go("home"); entry = null; G.startBox(Number(d.v ?? Math.floor(Math.random() * 3))); sfx("tap"); return go("dig");
    case "key": return pressKey(d.k);
    case "check": return submit();
    case "choose": return submit(Number(d.i));
    case "field": entry.active = d.f; return paintAnswer();
    case "carry": { const c = Number(d.c); entry.carries[c] = ((entry.carries[c] || 0) + 1) % 4; return paintAnswer(); }
    case "hint": { const b = G.S.box; b.h = Math.min(2, b.h + 1); G.save(); $("#help").innerHTML = helpHTML(cur(), b); if (b.h >= 2) a.remove(); else a.textContent = "Show me more"; return; }
    case "fresh": G.swapProblem(); entry = null; return dig();
    case "lens": lens = d.l; return dex();
    case "locked": { const s = BY_ID[d.id]; return toast(`#${pad3(s.num)} is still hidden. Look for it in Expedition ${s.st}: ${stageOf(s.st).name}.`); }
    case "quizstart": buildQuiz(); return quiz();
    case "quizpick": return quizPick(Number(d.i), a);
    case "quiznext": qz.i++; qz.missed = false; qz.answered = false; return quiz();
    case "lvl": { const m = G.S.math[d.s]; m.lvl = Math.max(1, Math.min(MAX_LEVEL, m.lvl + Number(d.d))); m.m = 0; m.bad = 0; G.save(); return grown(); }
    case "reset": if (confirm("Erase the whole collection and all math history on this device?")) { G.resetAll(); entry = null; qz = null; toast("Progress reset."); go("home"); } return;
  }
});

document.addEventListener("submit", e => {
  e.preventDefault();
  if (e.target.id === "nameform") { const v = $("#nm").value.trim(); if (!v) return; G.S.name = v; G.save(); go("guide/start"); }
  if (e.target.id === "pinform") {
    const v = $("#pin").value;
    if (!/^\d{4}$/.test(v)) return say("Use exactly 4 digits.", "soft");
    if (!G.S.pin) { G.S.pin = v; G.save(); grownOK = true; } else if (v === G.S.pin) grownOK = true; else return say("That PIN does not match.", "soft");
    grown();
  }
  if (e.target.id === "setform") {
    G.S.name = $("#setname").value.trim() || G.S.name; G.S.set.limit = Number($("#setlimit").value); G.S.set.sound = $("#setsound").checked;
    G.save(); toast("Settings saved.");
  }
});

document.addEventListener("keydown", e => {
  if (document.body.dataset.route !== "dig" || !G.S.box || !entry || e.metaKey || e.ctrlKey) return;
  if (/^[0-9.]$/.test(e.key)) pressKey(e.key);
  else if (e.key === "Backspace") { e.preventDefault(); pressKey("⌫"); }
  else if (e.key === "Enter") { e.preventDefault(); if (G.S.box.h >= 3) { G.swapProblem(); entry = null; dig(); } else submit(); }
  else if (e.key === "Tab" && Object.keys(entry.f).length > 1) { e.preventDefault(); const ks = Object.keys(entry.f); entry.active = ks[(ks.indexOf(entry.active) + 1) % ks.length]; paintAnswer(); }
});

// ───────── offline support
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready).then(async () => {
    // Quietly save every photo so the app works with no internet.
    if (!("caches" in window)) return;
    const cache = await caches.open("rockhound-img-v1");
    const urls = SPECIMENS.flatMap(s => [thumb(s.id), photo(s.id)]);
    for (let i = 0; i < urls.length; i += 6) {
      await Promise.all(urls.slice(i, i + 6).map(async u => { if (!(await cache.match(u))) { try { await cache.add(u); } catch { /* retry next launch */ } } }));
    }
  }).catch(() => { /* offline support is a bonus */ });
}

render();
