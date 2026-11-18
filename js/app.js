import { KINGDOMS, GROUPS, STAGES, SPECIMENS, BY_ID, GROUP_BY_ID, KINGDOM_BY_ID, TOTAL, RARITY, CRYSTAL_SYSTEMS, FINAL_RANK, kingdomOf, isRockLike, hardnessText, hardnessMid } from "./data.js";
import { LESSONS, LESSON_BY_ID } from "./lessons.js";
import { STRANDS, STRAND_IDS, MAX_LEVEL, MIN_LEVEL, check, skillsAt, skillName } from "./math.js";
import { crystalSVG, mysteryRock } from "./shapes.js";
import { CREDITS } from "./credits.js";
import * as G from "./store.js";
import * as Sync from "./sync.js";

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
function render(keepScroll = false) {
  const [name, arg] = (location.hash.slice(1) || "home").split("/");
  const fn = routes[name] || home;
  document.body.dataset.route = routes[name] ? name : "home";
  fn(arg);
  document.querySelectorAll("nav.tabs a").forEach(a => a.classList.toggle("on", a.dataset.tab === document.body.dataset.route || (a.dataset.tab === "dex" && name === "card") || (a.dataset.tab === "home" && (name === "dig" || name === "found"))));
  paintBadge();
  if (name !== "dig" && !keepScroll) window.scrollTo(0, 0);
}
function paintBadge() { const n = unreadLessons(), badge = $("#guidebadge"); badge.textContent = n || ""; badge.hidden = !n; }
function go(r) { if (location.hash.slice(1) === r) render(); else location.hash = r; }
window.addEventListener("hashchange", () => render());

// ───────── cloud save helpers
const CLOUD_TEXT = { saved: "☁️ Saved", pending: "☁️ Not saved yet", saving: "☁️ Saving…", gone: "☁️ Cloud save missing", off: "" };
const cloudText = () => CLOUD_TEXT[Sync.getStatus()] || "";
const CLOUD_ERR = { key: "That family key is not right.", code: "That code was not found. Check each character and try again.",
  full: "This family already has the largest number of cloud saves allowed.", offline: "No internet connection. Try again when you are online.",
  slow: "Too many tries. Please wait ten minutes.", setup: "Cloud save has not been set up on the server yet." };
const cloudErr = e => CLOUD_ERR[e] || "Something went wrong. Please try again.";
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return !t ? "not yet" : m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };
function cloudSection() {
  if (!Sync.isOn()) return `<h3>Cloud save</h3>
    <p class="sub">Keeps this explorer's collection and math progress in your own private storage, so it follows them to any phone, tablet, or computer. Only the name and game progress are stored.</p>
    <form id="cloudform" class="settings"><label>Family key <input id="famkey" autocomplete="off" autocapitalize="none" spellcheck="false" required></label>
      <button class="btn">Turn on cloud save for ${esc(G.S.name || "this explorer")}</button></form>
    <form id="joinform" class="settings" style="margin-top:18px"><label>Or use an existing cloud save code on this device
      <input id="joincode" class="codein" maxlength="19" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" required></label>
      <button class="btn alt">Load that cloud save here</button><small class="sub">Anything already found on this device is added to it.</small></form>
    <div id="cloudmsg" class="feedback soft"></div>`;
  if (Sync.getStatus() === "gone") return `<h3>Cloud save</h3><p>This cloud save no longer exists. It was deleted from another device. Progress on this device is safe.</p>
    <button class="btn" data-act="cloudforget">Turn cloud save off here</button>`;
  return `<h3>Cloud save</h3>
    <p>Cloud save is <b>on</b> · <span id="cloudstate">${cloudText()}</span> · last saved ${ago(Sync.savedAt())}</p>
    <div class="codebox" aria-label="Cloud save code">${esc(Sync.getCode())}</div>
    <p class="sub">To continue on another device, open Rockhound there and choose <b>I already have a cloud save code</b> on the welcome screen. Keep this code private: anyone who has it can load and change this collection. Each explorer gets their own code.</p>
    <div class="row left"><button class="btn" data-act="syncnow">Save now</button><button class="btn alt" data-act="signout">Sign out on this device</button><button class="btn danger" data-act="clouddelete">Delete cloud save</button></div>
    <div id="cloudmsg" class="feedback soft"></div>`;
}

// ───────── HOME
// What the first problems will be for each starting point (levels listed in G.STARTS).
const START_CHOICES = [
  [MIN_LEVEL, "Small numbers", "Counting, adding and taking away up to 20, doubles and halves."],
  [1, "Two-digit numbers", "Sums like 47 + 8, the 2, 3, 4, 5 and 10 times tables, naming fractions."],
  [3, "Three-digit numbers", "Sums like 346 + 128, times tables up to 12, first division."],
];
const levelName = lvl => (lvl === MIN_LEVEL ? "Starter" : lvl);
function welcome() {
  document.body.dataset.route = "welcome";
  view.innerHTML = `<section class="welcome">
    <div class="wrock">${mysteryRock(0, 2)}</div>
    <h1>Rockhound</h1>
    <p class="lead">Crack open mystery rocks. Collect ${TOTAL} real rocks, minerals, gems, and crystals.</p>
    <form id="nameform"><label for="nm">What is your name, rockhound?</label>
      <input id="nm" maxlength="16" autocomplete="off" autocapitalize="words" placeholder="Your first name" required>
      <fieldset class="startpick"><legend>Grown-ups: where should the math start?</legend>
        ${START_CHOICES.map(([lvl, title, about]) => `<label><input type="radio" name="start" value="${lvl}"><span><b>${title}</b><small>${about}</small></span></label>`).join("")}
        <small class="sub">Not sure? Pick the easier one. The math gets harder by itself, and you can change it any time under Grown-ups.</small>
      </fieldset>
      <div id="startmsg" class="feedback"></div>
      <button class="btn big">Start exploring</button></form>
    <p class="foot"><a data-act="showjoin">I already have a cloud save code</a></p>
    <form id="joinform" hidden><label for="joincode">Type your cloud save code</label>
      <input id="joincode" class="codein" maxlength="19" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" required>
      <button class="btn big alt">Load my collection</button><div id="feedback" class="feedback"></div></form>
  </section>`;
}

function home() {
  const S = G.S;
  if (!S.name) return welcome();
  const st = G.stageNow(), done = st > STAGES.length, stage = stageOf(st), found = G.countFound();
  let cta;
  if (done) cta = `<div class="panel center"><h2>🏛️ The collection is complete!</h2><p>You found all ${TOTAL} specimens and earned the rank of <b>${FINAL_RANK}</b>. Visit your collection, earn stars in the Field Test, or re-read the Field Guide.</p></div>`;
  else if (S.box) cta = `<div class="panel center"><h2>Keep cracking!</h2><button class="rockbtn solo" data-go="dig">${mysteryRock(S.box.variant, S.box.i + (S.box.ok ? 1 : 0))}</button><p>${S.box.i + (S.box.ok ? 1 : 0)} of 3 strikes done.</p><button class="btn big" data-go="dig">Pick up the hammer</button></div>`;
  else if (!G.canDig()) cta = `<div class="panel center"><h2>⛺ The dig site is closed for today</h2><p>You cracked ${G.boxesToday()} rocks today. Great work! Come back tomorrow for more. Until then, explore your collection or the Field Guide.</p></div>`;
  else cta = `<h2 class="pickh">Pick a mystery rock to crack!</h2><div class="rocks">${[0, 1, 2].map(v => `<button class="rockbtn" data-act="pick" data-v="${v}" aria-label="Mystery rock ${v + 1}">${mysteryRock(v)}</button>`).join("")}</div><p class="sub center">Three hammer strikes. Each strike is a math problem.</p>`;
  const recent = S.order.slice(0, 6).map(id => BY_ID[id]).filter(Boolean);
  view.innerHTML = `<section class="home">
    <div class="hero">
      <div class="rankrow"><span class="rank">🏅 ${G.rankName()}</span><span class="rankright">${Sync.isOn() ? `<span class="cloud" id="cloudchip">${cloudText()}</span>` : ""}<span class="count">${found} / ${TOTAL}</span></span></div>
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

function vertHTML(p, solved) {
  const cols = Math.max(String(p.ans).length, ...p.vert.rows.map(r => String(r).length));
  const cell = (ch, c, cls = "") => `<span class="vc p${c % 3}${c % 3 === 0 && c > 0 ? " gap" : ""} ${cls}">${ch}</span>`;
  const row = n => { const s = String(n); let out = ""; for (let c = cols - 1; c >= 0; c--) out += cell(c < s.length ? s[s.length - 1 - c] : "", c); return out; };
  let carry = "";
  if (p.vert.op !== "−") { carry = `<div class="vrow"><span class="vop"></span>`; for (let c = cols - 1; c >= 0; c--) carry += c === 0 ? cell("", 0) : `<button class="vc vcarry p${c % 3}${c % 3 === 0 ? " gap" : ""}" data-act="carry" data-c="${c}" aria-label="carry">${entry.carries[c] || ""}</button>`; carry += "</div>"; }
  const typed = entry.f.a; let ans = "";
  for (let c = cols - 1; c >= 0; c--) ans += cell(typed[c] || "", c, "va" + (solved ? " ok" : c === typed.length ? " cur" : ""));
  return `<div class="vert" style="--cols:${cols}">${carry}${p.vert.rows.map((n, i) => `<div class="vrow"><span class="vop">${i === p.vert.rows.length - 1 ? p.vert.op : ""}</span>${row(n)}</div>`).join("")}
    <div class="vline"></div><div class="vrow"><span class="vop"></span>${ans}</div></div>
    ${solved ? "" : `<p class="vnote">Type the <b class="pu">units</b> digit first, just like on paper.</p>`}`;
}

function answerHTML(p, solved) {
  const box = (f, cls = "") => solved
    ? `<span class="ansbox ok ${cls}">${entry.f[f]}</span>`
    : `<button class="ansbox ${cls}${entry.active === f ? " active" : ""}" data-act="field" data-f="${f}">${entry.f[f] || `<span class="hole">?</span>`}</button>`;
  if (p.vert) return vertHTML(p, solved);
  if (p.type === "frac") return `<div class="ansrow"><div class="ansfrac">${box("n", "sm")}<span class="frbar"></span>${box("d", "sm")}</div></div>`;
  if (p.type === "rem") return `<div class="ansrow rem"><label>${box("q", "sm")}<span>${p.labels[0]}</span></label><label>${box("r", "sm")}<span>${p.labels[1]}</span></label></div>`;
  if (p.type === "choice") return solved ? `<div class="ansrow">${p.choices.map((c, i) => `<span class="ansbox chosen${i === p.ans ? " ok" : " dim"}">${c}</span>`).join("")}</div>` : "";
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
  // A solved problem stays on screen until he chooses to move on.
  if (b.ok) return `<div class="pad next"><button class="btn big" data-act="next">${b.i >= 2 ? "Break it open! ▸" : "Next strike ▸"}</button></div>`;
  if (b.h >= 3) return `<div class="pad done"></div>`;
  if (p.type === "choice") return `<div class="pad choices">${p.choices.map((c, i) => `<button class="btn choice" data-act="choose" data-i="${i}">${c}</button>`).join("")}</div>`;
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", p.dec ? "." : "", "0", "⌫"];
  return `<div class="pad">${keys.map(k => k ? `<button class="key${k === "⌫" ? " back" : ""}" data-act="key" data-k="${k}">${k}</button>` : `<span></span>`).join("")}
    <button class="btn big check" data-act="check">🔨 Strike!</button></div>`;
}

// What the answer boxes show for a solved problem after a reload (the typed entry is gone).
function solvedEntry(p) {
  const f = p.type === "frac" ? { n: String(p.ans.n), d: String(p.ans.d) } : p.type === "rem" ? { q: String(p.ans.q), r: String(p.ans.r) }
    : { a: p.type === "choice" ? "" : p.vert ? String(p.ans).split("").reverse().join("") : String(p.ans) };
  return { f, active: "", carries: [] };
}

function dig() {
  const b = G.S.box;
  if (!b) return go("home");
  const p = cur(), sd = STRANDS[p.strand];
  if (!entry) { if (b.ok) entry = solvedEntry(p); else resetEntry(); }
  busy = false;
  const cracks = b.i + (b.ok ? 1 : 0);
  view.innerHTML = `<section class="dig">
    <div class="digtop"><button class="link" data-go="home">‹ Camp</button>
      <div class="strikes">${[0, 1, 2].map(i => `<span class="${i < cracks ? "hit" : i === b.i ? "now" : ""}">🔨</span>`).join("")}</div>
      <span class="chip">${sd.icon} ${sd.name}</span></div>
    <div class="digbody">
      <div class="rockwrap" id="rockwrap">${mysteryRock(b.variant, cracks)}<p class="sub">${b.ok ? (b.i >= 2 ? "It is ready to break open!" : "The rock is cracking…") : `Strike ${b.i + 1} of 3`}</p></div>
      <div class="problem" id="problem">
        <div class="q">${p.q}</div>
        ${p.vis ? `<div class="vis">${p.vis}</div>` : ""}
        <div id="answer"${b.h >= 3 && !b.ok ? " hidden" : ""}>${answerHTML(p, b.ok)}</div>
        <div id="feedback" class="feedback${b.ok ? " good" : ""}" aria-live="polite">${b.ok ? `<b>✓ ${b.praise || "Correct!"}</b><span>You got it right.</span>` : ""}</div>
        <div id="help">${b.ok ? "" : helpHTML(p, b)}</div>
        ${b.h < 2 && !b.ok ? `<button class="link hintbtn" data-act="hint">${b.h ? "Show me more" : "💡 I'd like a hint"}</button>` : ""}
      </div>
      <div id="pad">${padHTML(p, b)}</div>
    </div></section>`;
  shownDig = digSig();
}
// What the dig screen is currently showing, so a cloud update only redraws it if the rock itself changed.
let shownDig = "";
function digSig() { const b = G.S.box; if (!b) return ""; const p = b.probs[b.i] || {}; return [b.target, b.i, b.ok ? 1 : 0, p.skill, JSON.stringify(p.ans)].join("|"); }
const paintAnswer = () => { $("#answer").innerHTML = answerHTML(cur()); };
const say = (html, cls = "") => { const f = $("#feedback"); if (f) { f.className = "feedback " + cls; f.innerHTML = html; } };
// Keep the newest message in view inside the problem card.
const reveal = sel => { const el = $(sel); if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", behavior: "smooth" }); };

function pressKey(k) {
  if (busy || !G.S.box || G.S.box.h >= 3 || G.S.box.ok) return;
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
  if (busy || !G.S.box || G.S.box.ok) return;
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
  reveal(b.h >= 2 ? "#help" : "#feedback");
}

// Correct! Record it, crack the rock, and wait on this screen until he taps Next.
function strike() {
  const b = G.S.box, p = cur();
  if (G.recordSolve(p, b.tries) === "up") b.ups.push(p.strand);
  b.ok = true; b.praise = pick(HIT);
  G.save();
  sfx("crack");
  dig();
  $("#rockwrap").classList.add("struck");
  reveal("#feedback");
}

function nextStrike() {
  const b = G.S.box;
  if (busy || !b || !b.ok) return;
  b.i++; b.ok = false; b.praise = ""; b.tries = 0; b.miss = 0; b.h = 0; entry = null;
  G.save();
  if (b.i < 3) { sfx("tap"); return dig(); }
  busy = true;
  const wrap = $("#rockwrap");
  if (wrap) { sfx("open"); wrap.classList.add("burst"); }
  setTimeout(() => { G.award(); Sync.checkpoint(); sfx("found"); go("found"); }, 800);
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
  if (L.ups && L.ups.length) extra += `<div class="banner teal">⭐ Math power up: ${L.ups.map(u => `<b>${STRANDS[u].name}</b> is now level ${levelName(G.S.math[u].lvl)}`).join(" · ")}</div>`;
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
// "Found" view: hide everything not collected yet (remembered on this device).
let foundOnly = false;
try { foundOnly = localStorage.getItem("rockhound.foundonly") === "1"; } catch { /* default: show everything */ }
const grid = list => `<div class="grid">${(foundOnly ? list.filter(s => G.has(s.id)) : list).map(tile).join("")}</div>`;
const tally = list => `<span class="tally">${list.filter(s => G.has(s.id)).length}/${list.length}</span>`;
const worth = list => !foundOnly || list.some(s => G.has(s.id));   // skip sections with nothing found in them

function dex() {
  let body = "";
  if (lens === "family") {
    for (const k of KINGDOMS) {
      const ks = SPECIMENS.filter(s => kingdomOf(s) === k.id);
      if (!worth(ks)) continue;
      body += `<div class="kingdom k-${k.id}"><h2>${k.icon} ${k.name} ${tally(ks)}</h2><p>${k.rule}</p><p class="sub">${k.sort}</p></div>`;
      let lastCls = "";
      for (const g of GROUPS.filter(g => g.k === k.id)) {
        const multi = GROUPS.filter(x => x.cls === g.cls).length > 1, inCls = SPECIMENS.filter(s => GROUP_BY_ID[s.g].cls === g.cls);
        if (multi && g.cls !== lastCls && worth(inCls)) body += `<h3 class="cls">${g.cls} ${tally(inCls)}</h3>`;
        lastCls = g.cls;
        const list = SPECIMENS.filter(s => s.g === g.id);
        if (!worth(list)) continue;
        body += `<div class="group"><h4>${g.name}${g.sci ? ` <i>(${g.sci})</i>` : ""} ${tally(list)}</h4><p class="sub">${g.rule}</p>${grid(list)}</div>`;
      }
    }
  } else if (lens === "hardness") {
    const ref = ["", "Talc", "Gypsum", "Calcite", "Fluorite", "Apatite", "Orthoclase", "Quartz", "Topaz", "Corundum", "Diamond"];
    body += `<div class="kingdom"><h2>The Mohs hardness ladder</h2><p>A harder mineral scratches a softer one. Each step is named after its reference mineral.</p></div>`;
    for (let h = 10; h >= 1; h--) {
      const list = SPECIMENS.filter(s => s.h && Math.floor(hardnessMid(s)) === h).sort((a, c) => hardnessMid(c) - hardnessMid(a));
      if (list.length && worth(list)) body += `<div class="group"><h4><span class="hnum">${h}</span> As hard as ${ref[h].toLowerCase()} ${tally(list)}</h4>${grid(list)}</div>`;
    }
    const rest = SPECIMENS.filter(s => !s.h);
    if (worth(rest)) body += `<div class="group"><h4>Rocks and space rocks ${tally(rest)}</h4><p class="sub">A rock is a mixture, so it has no single hardness. Each mineral grain inside has its own.</p>${grid(rest)}</div>`;
  } else if (lens === "crystal") {
    body += `<div class="kingdom"><h2>The seven crystal systems</h2><p>Every mineral's atoms stack in exactly one of seven patterns.</p></div>`;
    for (const c of CRYSTAL_SYSTEMS) {
      const list = SPECIMENS.filter(s => s.cs === c.id);
      if (worth(list)) body += `<div class="group"><h4 class="withsvg">${crystalSVG(c.id, 44)} ${c.name} ${tally(list)}</h4><p class="sub">${c.note}</p>${grid(list)}</div>`;
    }
    const none = SPECIMENS.filter(s => s.cs === "none"), rest = SPECIMENS.filter(s => !s.cs);
    if (worth(none)) body += `<div class="group"><h4>No crystal pattern ${tally(none)}</h4><p class="sub">Mineraloids: their atoms are jumbled, or they were made by living things.</p>${grid(none)}</div>`;
    if (worth(rest)) body += `<div class="group"><h4>Rocks and space rocks ${tally(rest)}</h4><p class="sub">Mixtures of many crystals of different kinds.</p>${grid(rest)}</div>`;
  } else {
    body += `<div class="kingdom"><h2>💎 Gems</h2><p>A gem is not a separate kind of thing. It is any specimen beautiful, tough, and rare enough to wear. Most gems are minerals — but not all!</p></div>`;
    for (const k of KINGDOMS) {
      const list = SPECIMENS.filter(s => s.gem && kingdomOf(s) === k.id);
      if (list.length && worth(list)) body += `<div class="group"><h4>Gems that are ${k.name.toLowerCase()} ${tally(list)}</h4>${grid(list)}</div>`;
    }
  }
  const have = G.countFound();
  if (foundOnly && lens === "gems" && !SPECIMENS.some(s => s.gem && G.has(s.id))) body += `<div class="panel center"><p>No gems found yet. They are hiding in later expeditions.</p></div>`;
  if (foundOnly && !have) body = `<div class="panel center"><p>Nothing found yet. Crack a mystery rock to start your collection!</p><button class="btn" data-go="home">Go to the dig</button></div>`;
  view.innerHTML = `<section class="dex"><div class="dexhead"><h1>My Collection</h1><span class="count">${have} / ${TOTAL}</span></div>
    <div class="showrow" role="group" aria-label="What to show"><button class="${foundOnly ? "" : "on"}" data-act="show" data-f="0">Everything</button><button class="${foundOnly ? "on" : ""}" data-act="show" data-f="1">Only what I've found (${have})</button></div>
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
const finishHTML = (l, next) => G.S.read[l.id]
  ? `<p class="finished">✓ You finished this chapter.</p>${next ? `<button class="btn" data-go="guide/${next.id}">Next chapter: ${next.title} ▸</button>` : `<button class="btn" data-go="guide">Back to the Field Guide</button>`}`
  : `<p class="sub">Read all the way to here?</p><button class="btn big" data-act="finish" data-id="${l.id}">✓ I finished reading</button>`;

function guide(id) {
  const l = LESSON_BY_ID[id];
  if (l && lessonOpen(l)) {
    // Opening a chapter does not count as reading it. He marks it finished himself.
    const open = LESSONS.filter(lessonOpen), next = open[open.indexOf(l) + 1];
    view.innerHTML = `<section class="lesson"><div class="cardnav"><button class="link" data-go="guide">‹ Field Guide</button></div>
      <article class="paper"><div class="licon">${l.icon}</div><h1>${l.title}</h1>${l.body}
      <div class="finish" id="finish">${finishHTML(l, next)}</div></article></section>`;
    return;
  }
  view.innerHTML = `<section class="guide"><h1>Field Guide</h1><p class="sub">A new chapter unlocks each time you reach a new expedition.</p>
    <div class="chapters">${LESSONS.map((x, i) => lessonOpen(x)
      ? `<button class="chapter" data-go="guide/${x.id}"><span class="licon">${x.icon}</span><span><small>Chapter ${i + 1}</small><b>${x.title}</b></span>${G.S.read[x.id] ? `<span class="tick">✓ Read</span>` : `<span class="new">TO READ</span>`}</button>`
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
  const goal = G.masteryGoal();
  const rows = STRAND_IDS.map(id => {
    const m = S.math[id];
    const agg = S.log.filter(l => l.s === id), ft = agg.filter(l => l.n === 1).length;
    return `<tr><td><b>${STRANDS[id].icon} ${STRANDS[id].long}</b><br><small>Working on: ${skillsAt(id, m.lvl).map(s => s.name).join("; ")}</small></td>
      <td class="lv"><button class="key sm" data-act="lvl" data-s="${id}" data-d="-1">−</button><b>${levelName(m.lvl)}</b><button class="key sm" data-act="lvl" data-s="${id}" data-d="1">+</button><br><small class="dots">${"●".repeat(Math.min(m.m, goal))}${"○".repeat(Math.max(0, goal - m.m))}</small></td>
      <td>${agg.length ? Math.round(100 * ft / agg.length) + "%" : "—"}<br><small>${agg.length} recent</small></td></tr>`;
  }).join("");
  const label = n => n === 1 ? "✓ first try" : n === 2 ? "2 tries" : "needed the worked example";
  view.innerHTML = `<section class="guide grown"><h1>Grown-ups</h1>
    <div class="paper">
      <h3>Progress</h3>
      <p><b>${G.countFound()}</b> of ${TOTAL} specimens · Expedition ${Math.min(G.stageNow(), STAGES.length)} of ${STAGES.length} · <b>${S.solved}</b> problems solved · ${total.a ? Math.round(100 * total.f / total.a) : 0}% right on the first try · ${G.boxesToday()} rocks today</p>
      <h3>Math levels</h3>
      <div class="settings pacebox"><label>How quickly the math gets harder
        <select id="setpace">${Object.entries(G.PACES).map(([id, v]) => `<option value="${id}"${(G.S.set.pace || "gentle") === id ? " selected" : ""}>${v.name}</option>`).join("")}</select></label>
        <small class="sub">${G.pace().about}</small></div>
      <p class="sub">Each strand has ${MAX_LEVEL} levels, plus an easier Starter level below level 1, and moves on its own. The dots fill with first-try solves at the current level; a miss empties one or two. When they are full the strand may move up${G.pace().perDay < 9 ? ` (${G.risesToday()} of ${G.pace().perDay} used today)` : ""}. A few misses in a row move it back down. A level he has only just reached is mixed half-and-half with easier review. Use − and + to place him by hand at any time.${G.levelFloor() === MIN_LEVEL ? "" : " On this save, play never drops below level 1 by itself; the Starter level is only reached with the − button."}</p>
      <table class="gtable"><tr><th>Strand</th><th>Level</th><th>First try</th></tr>${rows}</table>
      <h3>Recent problems</h3>
      ${S.log.length ? `<table class="gtable small">${S.log.slice(0, 15).map(l => `<tr><td>${STRANDS[l.s].icon} L${l.l}</td><td>${skillName(l.k)}</td><td>${label(l.n)}</td></tr>`).join("")}</table>` : `<p class="sub">Nothing yet.</p>`}
      <div id="cloudsec">${cloudSection()}</div>
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
    case "field": if (G.S.box.ok) return; entry.active = d.f; return paintAnswer();
    case "carry": { if (G.S.box.ok) return; const c = Number(d.c); entry.carries[c] = ((entry.carries[c] || 0) + 1) % 4; return paintAnswer(); }
    case "hint": { const b = G.S.box; b.h = Math.min(2, b.h + 1); G.save(); $("#help").innerHTML = helpHTML(cur(), b); if (b.h >= 2) a.remove(); else a.textContent = "Show me more"; reveal("#help"); return; }
    case "fresh": G.swapProblem(); entry = null; return dig();
    case "next": return nextStrike();
    case "finish": {
      const l = LESSON_BY_ID[d.id]; G.S.read[l.id] = 1; G.save(); Sync.checkpoint(); sfx("star");
      const open = LESSONS.filter(lessonOpen);
      $("#finish").innerHTML = finishHTML(l, open[open.indexOf(l) + 1]);
      return paintBadge();
    }
    case "lens": lens = d.l; return dex();
    case "show": foundOnly = d.f === "1"; try { localStorage.setItem("rockhound.foundonly", foundOnly ? "1" : "0"); } catch { /* fine */ } return dex();
    case "locked": { const s = BY_ID[d.id]; return toast(`#${pad3(s.num)} is still hidden. Look for it in Expedition ${s.st}: ${stageOf(s.st).name}.`); }
    case "quizstart": buildQuiz(); return quiz();
    case "quizpick": return quizPick(Number(d.i), a);
    case "quiznext": qz.i++; qz.missed = false; qz.answered = false; if (qz.i >= qz.qs.length) Sync.checkpoint(); return quiz();
    case "lvl": { const m = G.S.math[d.s]; m.lvl = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, m.lvl + Number(d.d))); m.m = 0; m.bad = 0; m.at = Date.now(); G.save(); Sync.checkpoint(4000); return grown(); }
    case "reset": if (confirm("Erase the whole collection and all math history on this device?")) { G.resetAll(); Sync.checkpoint(); entry = null; qz = null; toast("Progress reset."); go("home"); } return;
    case "showjoin": { const f = $("#joinform"); f.hidden = false; a.parentElement.hidden = true; $("#joincode").focus(); return; }
    case "syncnow": { const msg = $("#cloudmsg"); msg.textContent = "Saving…"; G.save(); Sync.push().then(ok => { if ($("#cloudsec")) { $("#cloudsec").innerHTML = cloudSection(); $("#cloudmsg").textContent = ok ? "Saved." : "Could not reach the cloud. It will keep trying."; } }); return; }
    case "signout": {
      if (!confirm("Sign out on this device?\n\nThe collection stays safe in the cloud save. This device goes back to the welcome screen. Make sure you have written down the code.")) return;
      Sync.signOut().then(ok => {
        if (!ok && !confirm("The latest changes on this device could not be saved to the cloud.\n\nSign out anyway and lose them?")) return;
        (ok ? Promise.resolve(true) : Sync.signOut(true)).then(() => { entry = null; qz = null; grownOK = false; go("home"); });
      });
      return;
    }
    case "clouddelete": if (confirm("Delete the cloud save?\n\nThe cloud copy is erased and the code stops working on every device. Progress on this device stays.")) Sync.removeCloud().then(ok => { if (ok) { toast("Cloud save deleted."); grown(); } else $("#cloudmsg").textContent = "Could not reach the cloud. Try again."; }); return;
    case "cloudforget": Sync.forgetLocal(); return grown();
  }
});

document.addEventListener("submit", e => {
  e.preventDefault();
  if (e.target.id === "nameform") {
    const v = $("#nm").value.trim(), picked = e.target.querySelector("input[name=start]:checked");
    if (!v) return;
    if (!picked) { const msg = $("#startmsg"); msg.className = "feedback soft"; msg.textContent = "Ask a grown-up to choose where the math should start."; return; }
    G.begin(v, Number(picked.value)); go("guide/start");
  }
  if (e.target.id === "joinform") {
    const btn = e.target.querySelector("button"), msg = $("#cloudmsg") || $("#feedback");
    btn.disabled = true; msg.className = "feedback soft"; msg.textContent = "Looking for that cloud save…";
    Sync.join($("#joincode").value).then(err => {
      if (err) { btn.disabled = false; msg.textContent = cloudErr(err); return; }
      entry = null; qz = null; toast("Cloud save loaded."); go("home");
    });
  }
  if (e.target.id === "cloudform") {
    const btn = e.target.querySelector("button"), msg = $("#cloudmsg");
    btn.disabled = true; msg.textContent = "Setting up…";
    Sync.create($("#famkey").value).then(err => {
      if (err) { btn.disabled = false; msg.textContent = cloudErr(err); return; }
      $("#cloudsec").innerHTML = cloudSection(); toast("Cloud save is on.");
    });
  }
  if (e.target.id === "pinform") {
    const v = $("#pin").value;
    if (!/^\d{4}$/.test(v)) return say("Use exactly 4 digits.", "soft");
    if (!G.S.pin) { G.S.pin = v; G.save(); grownOK = true; } else if (v === G.S.pin) grownOK = true; else return say("That PIN does not match.", "soft");
    grown();
  }
  if (e.target.id === "setform") {
    G.S.name = $("#setname").value.trim() || G.S.name; G.S.set.limit = Number($("#setlimit").value); G.S.set.sound = $("#setsound").checked; G.S.set.at = Date.now();
    G.save(); Sync.checkpoint(); toast("Settings saved.");
  }
});

document.addEventListener("change", e => {
  if (e.target.id !== "setpace") return;
  G.S.set.pace = e.target.value; G.S.set.at = Date.now();
  for (const id of STRAND_IDS) G.S.math[id].m = Math.min(G.S.math[id].m, G.masteryGoal());
  G.save(); Sync.checkpoint(); grown();
});

document.addEventListener("keydown", e => {
  if (document.body.dataset.route !== "dig" || !G.S.box || !entry || e.metaKey || e.ctrlKey) return;
  if (/^[0-9.]$/.test(e.key)) pressKey(e.key);
  else if (e.key === "Backspace") { e.preventDefault(); pressKey("⌫"); }
  else if (e.key === "Enter") { e.preventDefault(); if (G.S.box.ok) nextStrike(); else if (G.S.box.h >= 3) { G.swapProblem(); entry = null; dig(); } else submit(); }
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

// Newer progress arrived from the cloud. Fold it in without disturbing what he is doing:
// never scroll, and never rebuild the screen under his finger unless it is now wrong.
function absorbCloud() {
  const [name, arg] = (location.hash.slice(1) || "home").split("/");
  if (document.body.dataset.route === "welcome") return render();
  if (name === "dig") { if (digSig() !== shownDig) { entry = null; render(true); } return; }   // only if the rock itself changed
  if (name === "guide" && arg) {                                                                // reading a chapter: touch nothing but the finish line
    const l = LESSON_BY_ID[arg], f = $("#finish");
    if (l && f && G.S.read[l.id] && f.querySelector("[data-act=finish]")) { const open = LESSONS.filter(lessonOpen); f.innerHTML = finishHTML(l, open[open.indexOf(l) + 1]); }
    return paintBadge();
  }
  if (["home", "dex", "guide"].includes(name)) { const y = window.scrollY; render(true); window.scrollTo(0, y); return; }
  paintBadge();   // field card, reveal, Field Test, Grown-ups: left alone; they read fresh progress on the next move
}
// Cloud save: repaint the status chip when it changes; fold in newer progress when it arrives.
Sync.listen(
  () => { const c = $("#cloudchip"); if (c) c.textContent = cloudText(); const st = $("#cloudstate"); if (st) st.textContent = cloudText(); },
  absorbCloud);
render();
Sync.start();
