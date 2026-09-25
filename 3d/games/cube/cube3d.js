// Cube with {buddy}: a twisty puzzle cube (2x2 / 3x3) to play with, a guided
// beginner method, lessons, and help solving your own real cube.
// Rules and the solver live in cube-engine.js (pure, tested); this file is the
// game: modes, the guide, the HUD, the buddy. The cube is drawn by view3d.js,
// or by net.js (a flat unfolded cube) when the device can't show 3D.
/* global CubeEngine, KidsI18n, KidsStore, KidsAudio, KidsFx, Mascots */
import * as THREE from "three";
import * as Kit from "../../kit/kit.js";
import { TEXTS } from "./texts.js";
import { createCubeView } from "./view3d.js";
import { createNetView } from "./net.js";
import { stageIcon, holdIcon } from "./icons.js";
import { STICKER, BLANK } from "./palette.js";

const E = CubeEngine;
const GAME = "cube";
const DICT = {};
for (const lang of ["en", "es"])
  DICT[lang] = { ...Kit.KIT_DICT[lang], ...TEXTS[lang] };
const t = KidsI18n.translator(DICT);
const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const pick = (a) =>
  Array.isArray(a) ? a[Math.floor(Math.random() * a.length)] : a;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const isRot = (m) => !!m && "xyz".includes(m[0]);
const SPEED = { turn: 260, watch: 440, skip: 120, mix: 70, undo: 320 };

// ---------- progress (KidsStore keys cube.*) ----------
const key = (k) => `${GAME}.${k}`;
let size = KidsStore.load(key("size"), 3) === 2 ? 2 : 3;
const stars = KidsStore.load(key("stars"), {}); // { "3:0": 3, "2:1": 2, … }
const starOf = (n, i) => Math.min(3, stars[`${n}:${i}`] || 0);
const totalStars = () =>
  Object.values(stars).reduce((a, s) => a + Math.min(3, s || 0), 0);
KidsStore.setProgress(GAME, totalStars(), E.MAX_STARS);

// ---------- chips, buddy name ----------
Kit.ui.buddyChip($("#btnBuddy"), "pipo");
Kit.ui.langChip($("#btnLang"));
Kit.ui.soundChip($("#btnSound"));
let buddyId = Mascots.buddy("pipo");
const def = () => Mascots.get(buddyId);
const buddyName = () => KidsI18n.pickLang(def().name);
const treats = () => Mascots.treatName(def(), 2);
const colour = (c) => t("colors")[c];
const COLOUR = (c) => t("COLORS")[c];

// ---------- sound & voice ----------
document.addEventListener("pointerdown", () => KidsAudio.ensure(), true);
document.addEventListener("keydown", () => KidsAudio.ensure(), true);
const sfx = (name) => KidsAudio.sfx(name);
function speak(text) {
  if (KidsAudio.isMuted() || !("speechSynthesis" in window)) return;
  try {
    const clean = text
      .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{20E3}←→↑↓↻↺⇐⇒⇑⇓⇅✓×]/gu, "")
      .trim();
    if (!clean) return;
    const lang = KidsI18n.get() === "es" ? "es-ES" : "en-US";
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = lang;
    u.rate = 0.95;
    u.pitch = 1.2;
    const voices = speechSynthesis
      .getVoices()
      .filter((v) => v.lang.startsWith(lang.slice(0, 2)));
    const v =
      voices.find((x) => x.localService && x.lang === lang) ||
      voices.find((x) => x.localService);
    if (v) u.voice = v;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {}
}
const live = (text) => {
  $("#live").textContent = "";
  requestAnimationFrame(() => ($("#live").textContent = text));
};

// ---------- the view: 3D, or the flat net ----------
const flat = params.has("flat") || !Kit.hasWebGL();
let stage = null;
if (!flat) {
  stage = Kit.createStage({
    fallback: "?flat=1",
    parallax: 0.2,
    fov: 36,
    camera: { position: [4, 4, 8], target: [0, 0, 0] },
    sky: { top: "#7cc4ff", middle: "#cdeaff", bottom: "#ffe1f0" },
  });
}
if (!stage) {
  // no 3D: this game brings its own flat cube instead of the kit's card
  document.querySelector(".kit-fallback")?.remove();
  document.documentElement.classList.remove("kit-no3d");
  document.documentElement.classList.add("cu-isflat");
  $("#flat").hidden = false;
}
const handlers = {
  onTurn: (move) => userMove(move),
  onWholeTurn: (move, angle) => wholeTurn(move, angle),
  onStickerTap: (i) => stickerTap(i),
  onFaceSelect: (f) => faceSelect(f),
  badgeText: (m) => moveLabel(m).glyph + " " + t("wholeCube"),
};
const view = stage
  ? createCubeView(stage, handlers)
  : createNetView($("#flat"), handlers);
if (!stage) $("#flat").appendChild($("#flat .cu-flatbuddy"));

// ---------- the buddy (3D, or the 2D one in flat mode) ----------
let buddy;
if (stage) {
  const m = Kit.buddyMascot(stage, "pipo");
  m.object.scale.setScalar(0.62);
  m.lookAt(new THREE.Vector3(0, 0.5, 0));
  stage.tap(m.object, {
    label: () => t("buddyPoke", buddyName()),
    hitRadius: 1.1,
    hitOffset: [0, 1, 0],
    onTap: () => {
      m.celebrate(900);
      buddy.say(pick(t("poke")), 1800);
    },
  });
  buddy = {
    say: (text, ms = 3200) => (m.say(text, ms), speak(text)),
    hush: () => m.hush(),
    celebrate: (ms) => m.celebrate(ms),
    shake: () => m.shake(),
    mood: (x, ms) => m.setMood(x, ms),
    chomp() {
      let i = 0;
      const step = () => {
        m.mouth(i % 2 ? 0 : 0.9);
        if (++i < 6) setTimeout(step, 110);
        else m.mouth(0);
      };
      step();
    },
    object: m.object,
    talk() {
      m.setMood("hop", 500);
      let i = 0;
      const step = () => {
        m.mouth(i % 2 ? 0.1 : 0.6);
        if (++i < 10) setTimeout(step, 120);
        else m.mouth(0);
      };
      step();
    },
  };
  Mascots.onBuddyChange((id) => ((buddyId = id), renderTexts()));
} else {
  const m = Mascots.create($("#flatMascot"), $("#flatBubble"), buddyId);
  buddy = {
    say: (text, ms = 3200) => (m.say(text, ms), speak(text)),
    hush: () => m.hush(),
    celebrate(ms = 1400) {
      m.setMood("happy", ms);
      m.sound();
      KidsFx.burstFrom($("#flatMascot"));
    },
    shake: () => m.setMood("think", 900),
    mood: (x, ms) => m.setMood(x, ms),
    chomp() {
      m.setMood("happy", 900);
    },
  };
  Mascots.onBuddyChange((id) => {
    buddyId = id;
    m.use(id);
    renderTexts();
  });
}

// ---------- the cube state + animation queue ----------
let state = E.solved(size);
let mode = "home";
const queue = [];
let pumping = false;
let locked = false; // e.g. while an "oops" undoes itself
view.build(size);
view.setState(state);

function commit(move, { ms = SPEED.turn, from = 0 } = {}) {
  state = E.applyOne(state, move);
  const item = { move, ms, from, after: state.slice() };
  const done = new Promise((r) => (item.resolve = r));
  queue.push(item);
  if (!pumping) pump();
  return done;
}
async function pump() {
  pumping = true;
  view.arrow(null);
  while (queue.length) {
    const q = queue.shift();
    await view.turn(q.move, { ms: q.ms, after: q.after, from: q.from });
    q.resolve();
  }
  pumping = false;
  if (G && (mode === "guide" || mode === "lesson")) refreshCues();
}
const idle = () =>
  new Promise((resolve) => {
    const check = () =>
      pumping || queue.length ? setTimeout(check, 40) : resolve();
    check();
  });
function setCube(s, { pop = false } = {}) {
  state = s.slice();
  queue.length = 0;
  view.setState(state);
  if (pop && stage)
    stage.burst(new THREE.Vector3(0, size / 2 + 0.4, 0), {
      shape: "dot",
      count: 16,
      speed: 3,
    });
}
function setSize(n) {
  size = n;
  if (mode === "play") $("#sizeTxt").textContent = t(n === 3 ? "size3" : "size2");
  KidsStore.save(key("size"), n);
  queue.length = 0;
  view.build(n);
  setCube(E.solved(n));
  layout();
  renderSize();
}

// ---------- kid words for a move ----------
function moveLabel(tok, s = state) {
  const [text, glyph] = t("moveText")[tok] || [tok, ""];
  let hint = "";
  if (isRot(tok) && E.sizeOf(s) === 3) {
    const after = E.applyOne(s, tok);
    hint =
      tok[0] === "y"
        ? t("soFaces", COLOUR(after[2 * 9 + 4]))
        : t("soTop", COLOUR(after[4]));
  }
  return { text: hint ? `${text}, ${hint}` : text, glyph };
}
// the two ways to turn the layer a move is about (for buttons)
const bothWays = (tok) => {
  const L = tok[0];
  return [L, `${L}'`];
};

// ---------- input ----------
function userMove(move, from = 0) {
  if (locked || !E.isValidMove(move, size)) return false;
  if (mode === "home" || mode === "play") {
    playMove(move, from);
    return true;
  }
  if (mode === "guide" || mode === "lesson") return guideMove(move, from);
  return false;
}
function wholeTurn(move, angle) {
  if (locked) return false;
  if (mode === "home" || mode === "play") return userMove(move, angle);
  if ((mode === "guide" || mode === "lesson") && G && isRot(expected()))
    return userMove(move, angle);
  return false; // a peek: the cube springs back
}
const KEYS = "RLUDFBMESXYZ";
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector(".kit-backdrop")) return;
  const k = e.key.toUpperCase();
  if (!KEYS.includes(k) || k.length !== 1) return;
  const letter = "XYZ".includes(k) ? k.toLowerCase() : k;
  if ("MES".includes(letter) && size === 2) return;
  if (!["home", "play", "guide", "lesson"].includes(mode)) return;
  e.preventDefault();
  userMove(e.shiftKey ? `${letter}'` : letter);
});

// ========================================================== FREE PLAY
const P = { history: [], future: [], moves: 0, t0: 0, t1: 0, mixed: false };
let showPad = KidsStore.load(key("pad"), false);
let showTimer = KidsStore.load(key("timer"), false);
function playMove(move, from) {
  commit(move, { from });
  sfx("tap");
  if (mode !== "play") return;
  P.history.push(move);
  P.future = [];
  counted();
}
function counted() {
  P.moves++;
  if (P.mixed && !P.t0) P.t0 = performance.now();
  renderCounter();
  if (P.mixed && E.isSolved(state)) {
    P.mixed = false;
    P.t1 = performance.now();
    renderCounter();
    idle().then(() =>
      celebrate({ solved: true, say: t("solvedPlaySay", buddyName()) }),
    );
  }
}
async function mix() {
  if (locked) return;
  locked = true;
  const seq = E.scramble(size);
  seq.forEach((m) => commit(m, { ms: SPEED.mix }));
  sfx("level");
  P.history = [];
  P.future = [];
  P.moves = 0;
  P.t0 = 0;
  P.t1 = 0;
  P.mixed = true;
  renderCounter();
  await idle();
  locked = false;
}
function undo() {
  if (locked || !P.history.length) return;
  const m = P.history.pop();
  P.future.push(m);
  commit(E.invertMove(m), { ms: SPEED.undo });
  counted();
}
function redo() {
  if (locked || !P.future.length) return;
  const m = P.future.pop();
  P.history.push(m);
  commit(m, { ms: SPEED.undo });
  counted();
}
function reset() {
  if (locked) return;
  setCube(E.solved(size), { pop: true });
  P.history = [];
  P.future = [];
  P.moves = 0;
  P.t0 = P.t1 = 0;
  P.mixed = false;
  renderCounter();
}
const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
function renderCounter() {
  const c = $("#counter");
  c.hidden = !(mode === "play" && showTimer);
  if (c.hidden) return;
  const ms = P.t0 ? (P.t1 || performance.now()) - P.t0 : 0;
  c.textContent = `🔢 ${P.moves}  ⏱️ ${fmtTime(ms)}`;
  c.setAttribute("aria-label", `${t("moves", P.moves)}, ${fmtTime(ms)}`);
}
setInterval(
  () => mode === "play" && showTimer && P.t0 && !P.t1 && renderCounter(),
  500,
);
$("#btnMix").addEventListener("click", mix);
$("#btnSize").addEventListener("click", () => {
  if (locked) return;
  setSize(size === 3 ? 2 : 3);
  reset();
});
$("#btnUndo").addEventListener("click", undo);
$("#btnRedo").addEventListener("click", redo);
$("#btnReset").addEventListener("click", reset);
$("#btnPad").addEventListener("click", () => {
  showPad = !showPad;
  KidsStore.save(key("pad"), showPad);
  renderPlay();
});
$("#btnTimer").addEventListener("click", () => {
  showTimer = !showTimer;
  KidsStore.save(key("timer"), showTimer);
  renderPlay();
});
// "Help me": solve THIS cube step by step (a solved one gets mixed first)
$("#btnHelp").addEventListener("click", () => !locked && startGuide({ scramble: E.isSolved(state) }));

// the turn buttons: every side both ways, and the whole cube
const PAD = [
  ["L", ["L'", "L"]],
  ["R", ["R", "R'"]],
  ["U", ["U", "U'"]],
  ["D", ["D'", "D"]],
  ["F", ["F'", "F"]],
  ["B", ["B", "B'"]],
];
function renderPad() {
  const pad = $("#pad");
  pad.textContent = "";
  const names = t("faceNames");
  const groups = [
    ...PAD.map(([L, ms]) => [names["URFDLB".indexOf(L)], ms]),
    [t("wholeCube"), ["y", "y'", "x", "x'"]],
  ];
  for (const [name, moves] of groups) {
    const g = document.createElement("div");
    g.className = "cu-padgroup";
    const cap = document.createElement("span");
    cap.className = "cu-padcap";
    cap.textContent = name;
    g.appendChild(cap);
    const row = document.createElement("div");
    row.className = "cu-padrow";
    for (const m of moves) row.appendChild(moveButton(m, "cu-padbtn"));
    g.appendChild(row);
    pad.appendChild(g);
  }
}
function moveButton(m, cls) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.dataset.move = m;
  const { text, glyph } = moveLabel(m, E.solved(3));
  b.innerHTML = `<span class="cu-bglyph" aria-hidden="true">${glyph}</span><span class="cu-bnote" aria-hidden="true">${m}</span>`;
  b.setAttribute("aria-label", `${text} (${m})`);
  b.addEventListener("click", () => userMove(m));
  return b;
}
function renderPlay() {
  $("#sizeTxt").textContent = t(size === 3 ? "size3" : "size2");
  $("#pad").hidden = !showPad;
  $("#btnPad").setAttribute("aria-pressed", String(showPad));
  $("#btnTimer").setAttribute("aria-pressed", String(showTimer));
  $("#playTip").hidden = showPad || showTimer;
  renderPad();
  renderCounter();
  renderFlatDirs();
  layout();
}

// ========================================================== GUIDE
// G = the running guided solve: the plan flattened to one move per entry.
let G = null;
const expected = () => (G ? G.rest || G.flat[G.pos]?.move || null : null);
function plan() {
  const from = G.lesson ? G.lesson.stage : E.currentStage(state);
  const to = G.lesson ? G.lesson.stage : 99;
  const sol = E.solve(state, { from, to });
  G.stages = sol.stages;
  G.flat = [];
  sol.stages.forEach((st, si) =>
    st.steps.forEach((step, ki) =>
      step.moves.forEach((move, mi) =>
        G.flat.push({ move, stage: si, step: ki, mi, ref: step }),
      ),
    ),
  );
  G.pos = 0;
  G.rest = null;
  G.from = from;
  G.to = Math.min(to, sol.stages.length - 1);
  G.lastStep = null;
}
async function startGuide({
  scramble = true,
  real = false,
  lesson = null,
} = {}) {
  G = {
    real,
    lesson,
    watched: false,
    skipped: false,
    flat: [],
    pos: 0,
    done: false,
  };
  setMode(lesson ? "lesson" : "guide");
  if (scramble && !lesson) {
    locked = true;
    E.scramble(size, Math.random, size === 3 ? 25 : 11).forEach((m) =>
      commit(m, { ms: SPEED.mix }),
    );
    sfx("level");
    await idle();
    locked = false;
  }
  plan();
  renderGuide(true);
  if (!G.flat.length) finishAll();
}
function guideMove(m, from = 0) {
  const exp = expected();
  if (!exp || G.done) return false;
  const r = E.matchMove(exp, m);
  if (r.status === "done") {
    commit(m, { from });
    sfx("tap");
    advance(true);
  } else if (r.status === "partial") {
    commit(m, { from });
    sfx("tap");
    G.rest = r.rest;
    renderGuide();
  } else if (isRot(exp) && isRot(m)) {
    // any whole-cube turn is fine when one is asked for: plan again from here
    commit(m, { from });
    sfx("tap");
    const keep = { watched: G.watched, skipped: G.skipped };
    plan();
    Object.assign(G, keep);
    renderGuide(true);
  } else oops(m, exp, from);
  return true;
}
async function oops(m, exp, from) {
  const session = G;
  locked = true;
  commit(m, { from });
  sfx("wrong");
  buddy.shake();
  buddy.say(exp[0] === m[0] ? t("oopsDir") : t("oops"), 2200);
  await idle();
  await wait(reduced() ? 150 : 450);
  if (G !== session) return void (locked = false); // left the guide meanwhile
  commit(E.invertMove(m), { ms: SPEED.undo });
  await idle();
  locked = false;
}
function advance(byUser) {
  const cur = G.flat[G.pos];
  G.pos++;
  G.rest = null;
  const next = G.flat[G.pos];
  const stepDone = !next || next.step !== cur.step || next.stage !== cur.stage;
  if (byUser && stepDone) buddy.say(pick(t("yay")), 1200);
  if (!next || next.stage !== cur.stage) stageDone(cur.stage);
  renderGuide(stepDone);
}
function watch() {
  const exp = expected();
  if (!exp || locked || G.done) return;
  if (!G.real) G.watched = true;
  commit(exp, { ms: G.real ? SPEED.turn : SPEED.watch });
  advance(false);
}
function skipStage() {
  if (locked || !G || G.done) return;
  const cur = G.flat[G.pos];
  if (!cur) return;
  G.skipped = true;
  if (G.rest) commit(G.rest, { ms: SPEED.skip });
  else commit(cur.move, { ms: SPEED.skip });
  while (G.flat[G.pos + 1] && G.flat[G.pos + 1].stage === cur.stage) {
    G.pos++;
    commit(G.flat[G.pos].move, { ms: SPEED.skip });
  }
  G.rest = null;
  G.pos++;
  stageDone(cur.stage);
  renderGuide(true);
}
function backOne() {
  if (locked || !G || G.rest || G.pos === 0) return;
  const prev = G.flat[G.pos - 1];
  if (G.flat[G.pos] && prev.stage !== G.flat[G.pos].stage) return;
  G.pos--;
  commit(E.invertMove(prev.move), { ms: SPEED.undo });
  renderGuide(true);
}
$("#btnWatch").addEventListener("click", watch);
$("#btnDid").addEventListener("click", watch);
$("#btnSkip").addEventListener("click", skipStage);
$("#btnBack").addEventListener("click", backOne);

const stageNames = () => t(size === 3 ? "stage3" : "stage2");
function currentStageIndex() {
  if (!G) return 0;
  const cur = G.flat[G.pos];
  return cur ? cur.stage : G.stages.length;
}
async function stageDone(si) {
  const session = G;
  const last = G.lesson ? true : !G.flat[G.pos];
  await idle();
  if (G !== session) return;
  const name = stageNames()[si];
  if (last) return finishAll();
  sfx("star");
  buddy.celebrate(1400);
  // short, so the bubble hardly covers the cube; the treat flying into the
  // buddy's mouth tells the rest (the words are read out for pre-readers)
  buddy.say(t("stageDone", name), 2200);
  speak(`${t("stageDone", name)} ${t("stageTreat", buddyName(), treats())}`);
  feedTreat();
  renderStages();
}
// the buddy's treat pops out of the cube and flies into its mouth
function feedTreat() {
  if (!stage)
    return KidsFx.burstFrom($("#flatMascot"), [Mascots.treatOf(def()).icon]);
  const tr = Kit.treat(buddyId);
  tr.scale.setScalar(0.5);
  stage.scene.add(tr);
  const a = new THREE.Vector3(0, size / 2 + 0.6, 0);
  const b = buddy.object.localToWorld(new THREE.Vector3(0, 1.6, 0.4));
  stage.tween({
    ms: reduced() ? 1 : 750,
    ease: "inOutQuad",
    onUpdate: (v) => {
      tr.position.lerpVectors(a, b, v);
      tr.position.y += Math.sin(v * Math.PI) * 1.2;
      tr.rotation.y = v * 6;
    },
    onDone: () => {
      stage.scene.remove(tr);
      buddy.chomp();
      stage.burst(b, { shape: "star", count: 12 });
    },
  });
}
async function finishAll() {
  const session = G;
  if (!G || G.done) return;
  G.done = true;
  await idle();
  if (G !== session) return;
  view.arrow(null);
  view.glow([]);
  renderGuide();
  if (G.lesson) return lessonPositionDone();
  sfx("fanfare");
  celebrate({ solved: true });
  feedTreat();
  const i = await Kit.ui.dialog({
    icon: "🏆",
    title: t("solvedGuide"),
    body: t("solvedGuideBody", buddyName(), treats()),
    actions: [
      { text: `🏠 ${t("menu")}` },
      { text: `🎲 ${t("again")}`, primary: true },
    ],
  });
  if (i === 1) startGuide({ real: false });
  else setMode("home");
}
function celebrate({ solved = false, say = null } = {}) {
  sfx(solved ? "fanfare" : "star");
  buddy.celebrate(2000);
  if (say) buddy.say(say, 3500);
  if (stage) {
    stage.confetti();
    stage.burst(new THREE.Vector3(0, size / 2 + 0.5, 0), {
      shape: "star",
      count: 30,
    });
  } else KidsFx.confetti(2500);
}

// cues on the cube: the arrow for the next move and the glowing pieces
function piecesStickers(sets) {
  const g = E.geometry(size);
  const out = [];
  for (const set of sets || []) {
    const list = set.length === 3 ? g.corners : g.edges;
    const pos = list.find(
      (p) =>
        p.every((i) => set.includes(state[i])) &&
        set.every((c) => p.some((i) => state[i] === c)),
    );
    if (pos) out.push(...pos);
  }
  return out;
}
function refreshCues() {
  const exp = expected();
  if (!exp || G.done) {
    view.arrow(null);
    view.glow([]);
    return;
  }
  view.arrow(exp);
  view.glow(piecesStickers(G.flat[G.pos]?.ref.pieces));
}

// ---------- guide HUD ----------
// The buddy's one-sentence explanation lives in the card (so it never covers
// the cube); the buddy "talks" while it's read out.
function explain(text) {
  $("#sayFace").textContent = def().emoji;
  $("#sayText").textContent = text || "";
  if (!text) return;
  speak(text);
  buddy.talk?.();
}
function stepSentence(step) {
  const say = t("say");
  const cs = (step.pieces[0] || []).filter((c) => c !== E.WHITE);
  switch (step.kind) {
    case "hold":
      return say.hold(COLOUR(step.color));
    case "cross":
      return say.cross(colour(cs[0]));
    case "corner":
      return say.corner(colour(cs[0]), colour(cs[1]));
    case "middle":
      return say.middle(colour(step.pieces[0][0]), colour(step.pieces[0][1]));
    default:
      return typeof say[step.kind] === "function"
        ? say[step.kind]()
        : say[step.kind] || "";
  }
}
const TRICKS = Object.entries(E.ALGS);
function trickOf(step) {
  const s = step.moves.join(" ");
  const found = TRICKS.find(([, alg]) => s.includes(alg.join(" ")));
  return found ? found[0] : null;
}
function renderStages() {
  const ol = $("#stages");
  const names = stageNames();
  const cur = currentStageIndex();
  ol.textContent = "";
  names.forEach((name, i) => {
    const li = document.createElement("li");
    const done = G && (i < G.from || i < cur || (G.done && i <= G.to));
    const inLesson = G?.lesson && i !== G.lesson.stage;
    li.className = `cu-st${done ? " done" : ""}${i === cur && !G?.done ? " now" : ""}${inLesson ? " dim" : ""}`;
    li.innerHTML = `${stageIcon(size, i, { size: 34 })}<span class="cu-stn">${i + 1}</span>`;
    li.setAttribute(
      "aria-label",
      `${t("stageOf", i + 1, names.length, name)}${done ? " ✓" : ""}`,
    );
    li.title = name;
    ol.appendChild(li);
  });
  const now = document.createElement("li");
  now.className = "cu-stname";
  now.textContent = cur < names.length ? names[cur] : "🎉";
  now.setAttribute("aria-hidden", "true");
  ol.appendChild(now);
}
function renderGuide(stepChanged = false) {
  if (!G) return;
  renderStages();
  const exp = expected();
  const cur = G.flat[G.pos];
  $("#btnDid").hidden = !G.real;
  $("#btnBack").hidden = !G.real;
  $("#btnWatch").hidden = G.real;
  $("#btnSkip").hidden = G.real; // a real cube can't be fast-forwarded
  const hold = $("#hold");
  hold.hidden = !G.real;
  if (G.real) {
    if (size === 3) {
      hold.innerHTML = `${holdIcon(3, [state[4], state[22], state[13]], { size: 30 })}<span>${t("holdBadge", COLOUR(state[4]), COLOUR(state[22]))}</span>`;
    } else hold.innerHTML = `<span>🤲 ${t("holdBadge2")}</span>`;
  }
  const dirs = $("#dirs");
  dirs.textContent = "";
  if (!exp) {
    $("#mvGlyph").textContent = "🎉";
    $("#mvText").textContent = t("solvedGuide");
    $("#mvAlg").textContent = "";
    return;
  }
  const lbl = moveLabel(exp);
  $("#mvGlyph").textContent = lbl.glyph;
  $("#mvGlyph").classList.toggle("whole", isRot(exp));
  $("#mvText").innerHTML =
    `<span>${lbl.text}</span> <b class="cu-note">${exp}</b>`;
  // the step's moves as chips (a trick keeps its shape), the current one lit
  const alg = $("#mvAlg");
  alg.textContent = "";
  const trick = trickOf(cur.ref);
  if (trick) {
    const tag = document.createElement("span");
    tag.className = "cu-trick";
    tag.textContent = `✨ ${t("trick")[trick]}`;
    alg.appendChild(tag);
  }
  cur.ref.moves.forEach((m, i) => {
    const c = document.createElement("span");
    c.className = `cu-chip${i < cur.mi ? " past" : i === cur.mi ? " now" : ""}`;
    c.textContent = m;
    alg.appendChild(c);
  });
  if (!G.real)
    for (const m of bothWays(exp)) dirs.appendChild(moveButton(m, "cu-dirbtn"));
  if (stepChanged && cur.ref !== G.lastStep) {
    G.lastStep = cur.ref;
    explain(stepSentence(cur.ref));
    live(lbl.text);
  } else live(lbl.text);
  if (!pumping) refreshCues();
  layout();
}

// ========================================================== PAINT (real cube)
const ORDER = [2, 1, 5, 4, 0, 3]; // F R B L U D, as the child turns the cube
const PAINT = { step: 0, s: null, sel: 2 };
function startPaint() {
  setMode("paint");
  PAINT.step = 0;
  PAINT.s = new Array(6 * size * size).fill(-1);
  if (size === 3) for (let f = 0; f < 6; f++) PAINT.s[f * 9 + 4] = f;
  PAINT.sel = size === 3 ? 2 : 0;
  view.setState(PAINT.s);
  renderPaint();
}
function paintFace() {
  return ORDER[PAINT.step];
}
function stickerTap(i) {
  if (mode !== "paint") return;
  paintCell(i);
}
function faceSelect(f) {
  flatFace = f;
  if (mode === "play" || mode === "home") renderFlatDirs();
}
function paintCell(i) {
  const n = size;
  const f = Math.floor(i / (n * n));
  if (n === 3 && i % 9 === 4) return; // centres show which side is which
  if (f !== paintFace()) return;
  PAINT.s[i] = PAINT.s[i] === PAINT.sel ? -1 : PAINT.sel;
  sfx("tap");
  view.setState(PAINT.s);
  view.glow([]);
  renderPaint();
}
function renderPaint() {
  const n = size;
  const f = paintFace();
  $("#pStep").textContent = t("paintStep", PAINT.step + 1);
  $("#pText").textContent = t(size === 3 ? "paintFace3" : "paintFace2")[
    PAINT.step
  ];
  // hold diagram: what is on top, in front and on the right while painting this side
  const HOLD3 = {
    2: [0, 2, 1],
    1: [0, 1, 5],
    5: [0, 5, 4],
    4: [0, 4, 2],
    0: [5, 0, 1],
    3: [2, 3, 1],
  };
  const [u, fr, r] = HOLD3[f];
  $("#pDiag").innerHTML =
    size === 3
      ? holdIcon(3, [u, fr, r], { size: 64 })
      : holdIcon(2, [-1, PAINT.s[f * 4] >= 0 ? PAINT.s[f * 4] : -1, -1], {
          size: 64,
        });
  const grid = $("#pGrid");
  grid.style.setProperty("--n", n);
  grid.textContent = "";
  grid.setAttribute("aria-label", t("paintStep", PAINT.step + 1));
  for (let k = 0; k < n * n; k++) {
    const i = f * n * n + k;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cu-pcell";
    const c = PAINT.s[i];
    b.style.background = c >= 0 ? STICKER[c] : BLANK;
    b.dataset.i = i;
    const fixed = n === 3 && k === 4;
    b.disabled = fixed;
    if (fixed) b.classList.add("fixed");
    b.setAttribute(
      "aria-label",
      t(
        "cellLabel",
        Math.floor(k / n) + 1,
        (k % n) + 1,
        c >= 0 ? colour(c) : t("blank"),
      ),
    );
    b.addEventListener("click", () => paintCell(i));
    grid.appendChild(b);
  }
  const pal = $("#palette");
  pal.textContent = "";
  const counts = [0, 0, 0, 0, 0, 0];
  PAINT.s.forEach((c) => c >= 0 && counts[c]++);
  for (let c = 0; c < 6; c++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `cu-pcol${PAINT.sel === c ? " on" : ""}`;
    b.style.setProperty("--c", STICKER[c]);
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(PAINT.sel === c));
    b.setAttribute(
      "aria-label",
      `${t("pickColor", colour(c))}, ${t("left", n * n - counts[c])}`,
    );
    const left = n * n - counts[c];
    b.innerHTML = `<span class="cu-pleft${left < 0 ? " over" : left === 0 ? " zero" : ""}" aria-hidden="true">${left}</span>`;
    b.addEventListener("click", () => {
      PAINT.sel = c;
      sfx("tap");
      renderPaint();
    });
    pal.appendChild(b);
  }
  $("#btnPrev").disabled = PAINT.step === 0;
  $("#btnNext").hidden = PAINT.step === 5;
  $("#btnCheck").hidden = PAINT.step !== 5;
  view.present(f);
  layout();
}
$("#btnPrev").addEventListener("click", () => {
  if (PAINT.step > 0) PAINT.step--;
  renderPaint();
});
$("#btnNext").addEventListener("click", () => {
  if (PAINT.step < 5) PAINT.step++;
  renderPaint();
});
$("#btnCheck").addEventListener("click", checkPaint);
async function checkPaint() {
  const v = E.validate(PAINT.s);
  if (v.ok) {
    sfx("correct");
    buddy.celebrate(1200);
    buddy.say(t("paintOk"), 2500);
    view.present(null);
    state = PAINT.s.slice();
    view.setState(state);
    await wait(reduced() ? 100 : 900);
    return startGuide({ scramble: false, real: true });
  }
  sfx("wrong");
  buddy.mood("think", 1800);
  const err = t("paintErr");
  const list = (cs) => {
    const names = [...new Set(cs)].map(colour);
    return names.length > 1
      ? `${names.slice(0, -1).join(", ")} ${t("and")} ${names.at(-1)}`
      : names[0];
  };
  let body = "";
  if (v.code === "count")
    body = err.count(colour(v.over[0] ?? 0), colour(v.under[0] ?? 0));
  else if (v.code === "corner" || v.code === "edge")
    body = err[v.code](list(v.colors));
  else body = err[v.code];
  if (["twist", "flip", "parity"].includes(v.code))
    body += ` ${t("paintErrTip")}`;
  // show the first problem sticker's side, glowing
  const first = v.stickers.find((i) => i >= 0);
  if (
    first != null &&
    ["unpainted", "count", "corner", "edge"].includes(v.code)
  ) {
    PAINT.step = ORDER.indexOf(Math.floor(first / (size * size)));
    renderPaint();
    view.glow(v.stickers, { error: true });
    $("#pGrid")
      .querySelectorAll(".cu-pcell")
      .forEach((b) =>
        b.classList.toggle("err", v.stickers.includes(+b.dataset.i)),
      );
  }
  await Kit.ui.dialog({
    icon: "🔍",
    title: t("errTitle"),
    body,
    actions: [{ text: t("fix"), primary: true }],
  });
}

// ========================================================== LEARN
function renderLessons() {
  const box = $("#lessons");
  box.textContent = "";
  const names = stageNames();
  $("#learnSize").textContent = t(size === 3 ? "size3" : "size2");
  $("#learnStars").textContent = t("totalStars", totalStars(), E.MAX_STARS);
  names.forEach((name, i) => {
    const open = i === 0 || starOf(size, i - 1) > 0;
    const got = starOf(size, i);
    const b = document.createElement("button");
    b.type = "button";
    b.className = `cu-lesson${open ? "" : " locked"}`;
    b.disabled = !open;
    b.innerHTML = `<span class="cu-licon">${stageIcon(size, i, { size: 56 })}</span><span class="cu-ltext"><small>${t("lesson", i + 1)}</small><b>${name}</b><span class="stars">${[0, 1, 2].map((k) => `<span class="${k < got ? "on" : ""}">★</span>`).join("")}</span></span>`;
    b.setAttribute("aria-label", t("lessonLabel", i + 1, name, got, open));
    b.addEventListener("click", () => openLesson(i));
    box.appendChild(b);
  });
}
async function openLesson(i) {
  const id = E.STAGES[size][i];
  const choice = await Kit.ui.dialog({
    icon: "📖",
    title: `${t("lesson", i + 1)}: ${stageNames()[i]}`,
    body: t("lessonIntro")[id],
    actions: [{ text: t("letsGo"), primary: true }],
  });
  if (choice !== 0) return;
  L = { stage: i, k: 0, watched: false, skipped: false };
  startLessonPosition();
}
let L = null;
function startLessonPosition() {
  setCube(E.lessonPosition(size, L.stage, L.k), { pop: true });
  startGuide({ scramble: false, lesson: { ...L } });
  G.watched = L.watched;
  G.skipped = L.skipped;
  buddy.say(t("practice", L.k + 1, E.LESSON_POSITIONS), 1600);
}
async function lessonPositionDone() {
  L.watched = G.watched;
  L.skipped = G.skipped;
  celebrate({ say: `${t("stageDone", stageNames()[L.stage])}` });
  feedTreat();
  L.k++;
  if (L.k < E.LESSON_POSITIONS) {
    await wait(reduced() ? 300 : 1600);
    if (mode === "lesson") startLessonPosition();
    return;
  }
  const got = E.lessonStars(L);
  const k = `${size}:${L.stage}`;
  stars[k] = Math.max(stars[k] || 0, got);
  KidsStore.save(key("stars"), stars);
  KidsStore.setProgress(GAME, totalStars(), E.MAX_STARS);
  sfx("level");
  const last = L.stage === E.STAGES[size].length - 1;
  const i = await Kit.ui.dialog({
    icon: "★".repeat(got) + "☆".repeat(3 - got),
    title: t("lessonDone"),
    body: t("lessonStars", got),
    actions: [
      { text: `📖 ${t("learnTitle")}` },
      ...(last ? [] : [{ text: `${t("nextLesson")} ▶`, primary: true }]),
    ],
  });
  if (i === 1) openLesson(L.stage + 1);
  else setMode("learn");
}

// ========================================================== FLAT VIEW EXTRAS
// In the flat net, tapping a side selects it; big ↻ ↺ buttons turn it.
let flatFace = 2;
function renderFlatDirs() {
  if (stage) return;
  const tip = $("#playTip");
  if (!tip || mode !== "play") return;
  tip.hidden = false;
  tip.textContent = "";
  const note = document.createElement("span");
  note.textContent = t("flatNote");
  tip.appendChild(note);
  const L = "URFDLB"[flatFace];
  const row = document.createElement("span");
  row.className = "cu-flatdirs";
  row.appendChild(moveButton(L, "cu-dirbtn"));
  row.appendChild(moveButton(`${L}'`, "cu-dirbtn"));
  tip.appendChild(row);
  view.select?.(flatFace);
}

// ========================================================== MODES + LAYOUT
function setMode(m) {
  mode = m;
  document.body.className = `mode-${m}`;
  for (const id of ["home", "play", "guide", "paint", "learn"])
    $(`#${id}`).hidden = true;
  const section = {
    home: "home",
    play: "play",
    guide: "guide",
    lesson: "guide",
    paint: "paint",
    learn: "learn",
  }[m];
  $(`#${section}`).hidden = false;
  $("#stages").hidden = !(m === "guide" || m === "lesson");
  $("#btnMenu").hidden = m === "home";
  $("#btnHome").hidden = m !== "home";
  view.idle = m === "home";
  view.present(null);
  view.arrow(null);
  view.glow([]);
  view.enabled = m !== "learn";
  stage?.clearBursts();
  buddy.hush();
  if (m !== "guide" && m !== "lesson") G = null;
  if (m === "play") {
    P.history = [];
    P.future = [];
    P.moves = 0;
    P.t0 = P.t1 = 0;
    renderPlay();
    renderFlatDirs();
  }
  if (m === "home") {
    renderHome();
    if (!E.isSolved(state)) setCube(E.solved(size));
  }
  if (m === "learn") {
    setCube(E.solved(size));
    renderLessons();
  }
  renderCounter();
  layout();
}
$("#btnMenu").addEventListener("click", () => {
  locked = false;
  queue.length = 0;
  setMode(mode === "lesson" ? "learn" : "home");
});
document.querySelectorAll(".cu-size button").forEach((b) =>
  b.addEventListener("click", () => {
    sfx("tap");
    setSize(+b.dataset.size);
  }),
);
document.querySelectorAll(".cu-mode").forEach((b) =>
  b.addEventListener("click", () => {
    sfx("tap");
    const go = b.dataset.go;
    if (go === "play") {
      setMode("play");
    } else if (go === "guide") startGuide();
    else if (go === "paint") startPaint();
    else setMode("learn");
  }),
);
function renderSize() {
  document
    .querySelectorAll(".cu-size button")
    .forEach((b) =>
      b.setAttribute("aria-checked", String(+b.dataset.size === size)),
    );
}
function renderHome() {
  renderSize();
  $("#learnAbout").textContent =
    `${t("modeLearnAbout")} · ${t("totalStars", totalStars(), E.MAX_STARS)}`;
}
function renderTexts() {
  KidsI18n.apply(DICT);
  document.title = t("docTitle", buddyName());
  $("#title").textContent = t("title", buddyName());
  $("#guideAbout").textContent = t("modeGuideAbout", buddyName());
  renderHome();
  if (mode === "play") renderPlay();
  if (mode === "guide" || mode === "lesson") {
    G.lastStep = null;
    renderGuide(true);
  }
  if (mode === "paint") renderPaint();
  if (mode === "learn") renderLessons();
  renderFlatDirs();
}
KidsI18n.onChange(renderTexts);

// Frame the cube (and the buddy) in the space the HUD leaves free.
function insets() {
  const h = innerHeight;
  const head = $(".cu-head").getBoundingClientRect().bottom;
  const st = $("#stages").hidden ? 0 : $("#stages").getBoundingClientRect().bottom;
  let top = Math.max(head, st) + 8;
  let bottom = 16;
  if (mode === "home") {
    top = $(".cu-title").getBoundingClientRect().bottom + 8;
    bottom = h - $(".cu-menucard").getBoundingClientRect().top + 8;
  } else if (mode === "learn") {
    // the cube waits below the lesson cards
    top = $(".cu-lessons").getBoundingClientRect().bottom + 8;
  } else {
    const panel = document.querySelector(".cu-dock:not([hidden])");
    if (panel) bottom = h - panel.getBoundingClientRect().top + 8;
  }
  return { top, bottom: Math.min(bottom, h * 0.66) };
}
function layout() {
  if (stage) return stage.refit();
  // flat view: size the net to the free space, the buddy sits just above the panel
  const { top, bottom } = insets();
  const f = $("#flat");
  f.style.top = `${top}px`;
  f.style.bottom = `${bottom}px`;
  const W = innerWidth - 24 - (innerWidth > 700 ? 200 : 0);
  const H = innerHeight - top - bottom - 20;
  const n = size;
  const cell = Math.floor(Math.min((W - 18 - 32) / (4 * n) - 3, (H - 12 - 24) / (3 * n) - 3));
  view.el.style.setProperty("--cell", `${Kit.clamp(cell, 12, 46)}px`);
  $(".cu-flatbuddy").style.bottom = `${bottom}px`;
}
addEventListener("resize", layout);
if (stage) {
  stage.onResize((w, h) => {
    const { top, bottom } = insets();
    // the buddy stands at the cube's lower left; on a phone it tucks in closer
    const n = size;
    const wide = w / h > 1;
    buddy.object.position.set(wide ? -(n / 2 + 1.5) : -(n / 2 + 0.2), -n / 2 - (wide ? 0.1 : 0.85), wide ? 0.4 : 1.4);
    buddy.object.rotation.y = 0.6;
    const pts = [...view.framePoints()];
    const bp = buddy.object.position;
    pts.push([bp.x - 0.6, bp.y, bp.z], [bp.x + 0.5, bp.y + 1.5, bp.z]);
    // lessons list: the cube only shows when there is room below the cards
    view.root.visible = mode !== "learn" || h - top - bottom > 220;
    buddy.object.visible = view.root.visible;
    stage.fitPoints(pts, { elevation: 24, azimuth: 30, margin: 1.02, insets: { top, bottom, left: 12, right: 12 } }, 450);
  });
  for (const sel of ["#guide", "#play", "#paint", "#home", "#stages", ".cu-lessons"])
    new ResizeObserver(() => stage.refit()).observe($(sel));
}

// e2e/debug handle (read-only use in tests)
window.__cube = {
  get state() {
    return state;
  },
  get mode() {
    return mode;
  },
  get guide() {
    return (
      G && {
        pos: G.pos,
        total: G.flat.length,
        expected: expected(),
        done: G.done || !expected(),
        watched: G.watched,
        skipped: G.skipped,
        stage: currentStageIndex(),
      }
    );
  },
  get busy() {
    return pumping || queue.length > 0 || locked;
  },
  view,
  stage,
  E,
};

// ---------- start ----------
renderTexts();
setMode("home");
if (params.get("size")) setSize(params.get("size") === "2" ? 2 : 3);
buddy.say(t("hello", buddyName()), 2600);
