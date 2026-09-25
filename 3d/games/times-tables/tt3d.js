// Times Tables 3D. Same rules, progress and dictionary as the 2D game
// (games/times-tables): TTLogic for the maths, TT_I18N for the words, the same
// KidsStore keys, so stars and treats are shared between 2D and 3D.
/* global KidsI18n, KidsStore, KidsAudio, Mascots, TT_I18N, TTLogic */
import * as THREE from "three";
import * as Kit from "../../kit/kit.js";
import {
  RUSH_MS,
  BONUS_MS,
  colorOf,
  planetLayout,
  learnLayout,
  playLayout,
  resultsLayout,
  padInput,
  rushBonusDue,
  PracticeRound,
} from "./logic.js";
import {
  createBackdrop,
  createPad,
  createJar,
  createFireRing,
  pop,
  hopTo,
} from "./world.js";
import { createPlanets } from "./planets.js";
import { createBoard } from "./board.js";
import { createBubbles, createKeypad } from "./answers.js";
import { createTimerRing, createRain } from "./rush.js";
import { createPodium } from "./podium.js";

const GAME = "times-tables";
const DEFAULT_BUDDY = "bollo";
const L = TTLogic;

// Words that only the 3D version needs (everything else comes from TT_I18N).
const TT3D = {
  en: {
    tapPlanet: "Tap a planet to pick a table! 🪐",
    buddyAria: (name) => `${name}. Tap to say hi`,
    count: (v) => `${v}!`,
    jarAria: (name, n, treats) => `${name}'s jar: ${n} ${treats}`,
    starsOf: (s) => `${s} of 3 stars`,
    countAlong: "Count with me!",
  },
  es: {
    tapPlanet: "¡Toca un planeta para elegir tabla! 🪐",
    buddyAria: (name) => `${name}. Tócalo para saludar`,
    count: (v) => `¡${v}!`,
    jarAria: (name, n, treats) => `Tarro de ${name}: ${n} ${treats}`,
    starsOf: (s) => `${s} de 3 estrellas`,
    countAlong: "¡Cuenta conmigo!",
  },
};
const DICT = {
  en: { ...Kit.KIT_DICT.en, ...TT_I18N.en, ...TT3D.en },
  es: { ...Kit.KIT_DICT.es, ...TT_I18N.es, ...TT3D.es },
};
const t = KidsI18n.translator(DICT);
const $ = (s) => document.querySelector(s);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const sfx = (name) => KidsAudio.sfx(name);
const restart = (el, cls) => {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
};

// ---------------------------------------------------------------- buddy & treat
let buddyId = Mascots.buddy(DEFAULT_BUDDY);
const FALLBACK_TREAT = {
  icon: "⭐",
  name: {
    en: { one: "star", many: "stars" },
    es: { one: "estrella", many: "estrellas" },
  },
};
const def = () => {
  const d = Mascots.get(buddyId);
  return d.treat ? d : { ...d, treat: FALLBACK_TREAT };
};
const buddyName = () => KidsI18n.pickLang(def().name);
const treatName = (count = 2) => Mascots.treatName(def(), count);
const treatEl = (cls = "treat") => Mascots.treatEl(def(), cls);

// ---------------------------------------------------------------- saved progress (shared with 2D)
const key = (k) => `${GAME}.${k}`;
const best = KidsStore.load(key("stars"), {});
const rushBest = KidsStore.load(key("rushBest"), {});
let treats = KidsStore.load(key("treats"), 0);
let selected = KidsStore.load(key("selected"), 1);
if (!L.TABLES.includes(selected)) selected = 1;
const starsOf = (n) => Math.min(3, best[n] || 0);
const proUnlocked = (n) => starsOf(n) >= 2;
function saveStars() {
  KidsStore.save(key("stars"), best);
  KidsStore.setProgress(GAME, L.totalStars(best), L.MAX_STARS);
}
function addTreats(n) {
  treats += n;
  KidsStore.save(key("treats"), treats);
}
KidsStore.setProgress(GAME, L.totalStars(best), L.MAX_STARS);

// ---------------------------------------------------------------- voice (muted = silent)
function speak(text) {
  if (KidsAudio.isMuted() || !("speechSynthesis" in window)) return;
  try {
    const lang = KidsI18n.get() === "es" ? "es-ES" : "en-US";
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.9;
    u.pitch = 1.2;
    const voices = speechSynthesis.getVoices();
    const v =
      voices.find((x) => x.lang === lang) ||
      voices.find((x) => x.lang.startsWith(lang.slice(0, 2)));
    if (v) u.voice = v;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {}
}
function hushVoice() {
  try {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  } catch {}
}

// ---------------------------------------------------------------- chips (work without WebGL too)
Kit.ui.buddyChip($("#btnBuddy"), DEFAULT_BUDDY);
Kit.ui.langChip($("#btnLang"));
Kit.ui.soundChip($("#btnSound"));
document.addEventListener("pointerdown", () => KidsAudio.ensure(), true);
document.addEventListener("keydown", () => KidsAudio.ensure(), true);

const stage = Kit.createStage({
  fallback: "../../../games/times-tables/",
  parallax: 0.35,
  fov: 38,
  camera: { position: [0, 3, 16], target: [0, 2, 0] },
});

if (!stage) {
  KidsI18n.apply(DICT);
  KidsI18n.onChange(() => KidsI18n.apply(DICT));
} else {
  run(stage);
}

function run(stage) {
  document.documentElement.classList.add("has-3d");
  createBackdrop(stage);

  // ---- the buddy, on its floating pad, with the streak fire around its feet
  const buddyRig = new THREE.Group();
  const buddyPad = createPad(1.05);
  const fire = createFireRing(stage);
  const buddy = Kit.buddyMascot(stage, DEFAULT_BUDDY);
  buddyRig.add(buddyPad, fire.root, buddy.object);
  stage.scene.add(buddyRig);
  buddy.lookAt("pointer");
  const buddyTap = stage.tap(buddy.object, {
    label: () => t("buddyAria", buddyName()),
    onTap: () => poke(),
    hitRadius: 1.1,
    hitOffset: [0, 1, 0],
  });

  // ---- the treat jar
  const jarRig = new THREE.Group();
  const jar = createJar(stage);
  const jarPad = createPad(0.78, "#ffc9de");
  jarRig.add(jarPad, jar.root);
  stage.scene.add(jarRig);
  const jarChip = document.createElement("div");
  jarChip.className = "kit-glass tt-jar-chip";
  jarChip.setAttribute("aria-hidden", "true");
  const jarPin = stage.pin(jarChip, jarRig, { offset: [0, 1.95, 0], align: "bottom" });

  // Keep the buddy's speech bubble on screen (the kit centres it on the head,
  // so near an edge it would be cut off): shift it with CSS `translate`, and
  // move its tail the other way so it still points at the buddy.
  const head = new THREE.Vector3();
  stage.onFrame(() => {
    const el = buddy.bubbleEl;
    if (!el || !el.classList.contains("show")) return;
    buddy.anchor.getWorldPosition(head);
    const p = stage.toScreen(head);
    const w = el.offsetWidth;
    const W = stage.size.width;
    let dx = 0;
    if (p.x - w / 2 < 8) dx = 8 - (p.x - w / 2);
    else if (p.x + w / 2 > W - 8) dx = W - 8 - (p.x + w / 2);
    dx = Math.round(dx);
    if (el.dataset.dx !== String(dx)) {
      el.dataset.dx = dx;
      el.style.translate = `${dx}px 0`;
      el.style.setProperty("--tt-tail", `${Math.max(-w / 2 + 24, Math.min(w / 2 - 24, -dx))}px`);
    }
  });

  // ---- screens' 3D pieces
  const planets = createPlanets(stage, {
    label: (n, s) => t("tableAria", n, s),
    onPick: (n) => selectTable(n),
  });
  const board = createBoard(stage);
  const hint = createBoard(stage, { ghosts: false });
  const bubbles = createBubbles(stage, {
    label: (v, k) => t("choiceAria", v, k),
    onPick: (i) => answer(bubbles.bubbles[i].value, i),
  });
  const keypad = createKeypad(stage, {
    label: (k) => (k === "⌫" ? t("clear") : k === "✓" ? t("check") : k),
    onKey: (k) => padKey(k),
  });
  const ring = createTimerRing(stage);
  const rain = createRain(stage);
  const podium = createPodium(stage);
  stage.scene.add(
    planets.group,
    board.group,
    hint.group,
    bubbles.group,
    keypad.group,
    ring.root,
    rain.group,
    podium.group,
  );

  // one flying treat per answer: a real Kit.treat, reused
  let flyer = null;
  function setBuddyTreat() {
    for (const x of [board, hint, jar, rain]) x.setTreat(buddyId);
    if (flyer) stage.scene.remove(flyer);
    flyer = Kit.treat(buddyId);
    flyer.visible = false;
    flyer.traverse((o) => (o.raycast = () => {}));
    stage.scene.add(flyer);
  }
  setBuddyTreat();

  // ---------------------------------------------------------------- screens
  let current = "home";
  const sections = [...document.querySelectorAll(".tt-screen")];

  function show(id) {
    hushVoice();
    const changed = id !== current;
    current = id;
    sections.forEach((s) => (s.hidden = s.id !== id));
    $("#btnHome").hidden = id !== "home";
    $("#btnBack").hidden = id === "home";
    $("#btnClassic").hidden = id !== "home";
    sync3D(changed);
    requestAnimationFrame(() => layout(true));
  }

  function sync3D(popIn) {
    const home = current === "home";
    const inPlay = current === "play";
    planets.group.visible = home;
    planets.enable(home);
    board.group.visible = current === "learn";
    bubbles.group.visible = inPlay && play.mode !== "pro";
    if (!inPlay) bubbles.hide();
    keypad.group.visible = inPlay && play.mode === "pro";
    keypad.enable(inPlay && play.mode === "pro");
    hint.group.visible = inPlay && play.hint;
    ring.root.visible = inPlay && play.mode === "rush";
    rain.group.visible = inPlay && play.mode === "rush";
    if (!(inPlay && play.mode === "rush")) rain.clear();
    podium.group.visible = current === "results";
    jarRig.visible = current !== "learn";
    jarPin.hidden = !jarRig.visible;
    buddyPad.visible = current !== "results";
    if (!inPlay) fire.level = 0;
    if (popIn) {
      const g = {
        home: planets.group,
        learn: board.group,
        results: podium.group,
      }[current];
      if (g) pop(stage, g, { from: 0.4, ms: 600 });
      if (inPlay && play.mode === "pro")
        pop(stage, keypad.group, { from: 0.3, ms: 600 });
      if (inPlay && play.mode === "rush") pop(stage, ring.root, { ms: 700 });
    }
  }

  // HUD sizes -> free space for the camera
  function hudSpace() {
    const H = innerHeight;
    const hud = $("#hud").getBoundingClientRect();
    document.documentElement.style.setProperty(
      "--hud-h",
      `${Math.round(hud.bottom)}px`,
    );
    const scr = document.getElementById(current);
    let top = hud.bottom;
    let bottom = 0;
    for (const el of scr.querySelectorAll(".tt-top")) {
      const r = el.getBoundingClientRect();
      if (r.height > 2) top = Math.max(top, r.bottom);
    }
    for (const el of scr.querySelectorAll(".tt-bottom")) {
      const r = el.getBoundingClientRect();
      if (r.height > 2) bottom = Math.max(bottom, H - r.top);
    }
    if (current === "play") bottom = Math.max(bottom, 78); // room for "Got it"
    if (current === "learn") bottom = Math.max(bottom, 90);
    return { top: top + 6, bottom: bottom + 6 };
  }

  // Frame a box of the world into the space between the HUD panels.
  function fitBox(box, ms) {
    const { height: h, aspect } = stage.size;
    const hs = hudSpace();
    const free = Math.max(0.3, (h - hs.top - hs.bottom) / h);
    const f = Kit.frame({
      center: box.center,
      width: box.width,
      height: box.height / free,
      fov: stage.camera.fov,
      aspect,
      elevation: 8,
      margin: 1.06,
    });
    const visible =
      2 * f.distance * Math.tan((stage.camera.fov * Math.PI) / 360);
    const up = ((hs.top - hs.bottom) / 2 / h) * visible;
    f.position[1] += up;
    f.target[1] += up;
    return stage.setView(f, ms);
  }

  const place = (obj, p, animate, s = 1) => {
    obj.scale.setScalar(s);
    if (animate) hopTo(stage, obj, p, { ms: 650, height: 0.9 });
    else obj.position.set(p.x, p.y, p.z);
  };

  let lastLayout = null;
  function layout(animate = false) {
    const aspect = stage.size.aspect;
    let box;
    if (current === "home") {
      const l = planetLayout(10, aspect);
      planets.layout(l.planets);
      place(buddyRig, l.buddy, animate);
      place(jarRig, l.jar, animate);
      box = l.box;
    } else if (current === "learn") {
      const l = learnLayout(learn.n, aspect);
      board.group.position.set(l.board.x, l.board.y, l.board.z);
      place(buddyRig, l.buddy, animate, l.buddy.s);
      box = l.box;
    } else if (current === "play") {
      const l = playLayout(play.mode, aspect);
      bubbles.layout(l.bubbles);
      keypad.group.position.set(l.keypad.x, l.keypad.y, l.keypad.z);
      hint.group.position.set(l.hint.x, l.hint.y, l.hint.z);
      play.hintBox = l.hint;
      ring.root.position.set(l.ring.x, l.ring.y, l.ring.z);
      ring.root.scale.setScalar(l.s);
      place(buddyRig, l.buddy, animate, l.s);
      place(jarRig, l.jar, animate, l.s);
      rain.setArea({
        x: l.box.center[0],
        w: l.box.width + 6,
        top: l.box.center[1] + l.box.height / 2 + 3,
        bottom: l.box.center[1] - l.box.height / 2 - 4,
      });
      box = l.box;
    } else {
      const l = resultsLayout(aspect);
      podium.group.position.set(l.podium.x, l.podium.y, l.podium.z);
      place(buddyRig, { x: l.buddy.x, y: podium.top, z: l.buddy.z }, animate);
      place(jarRig, l.jar, animate);
      play.starSpots = l.stars;
      box = l.box;
    }
    buddyTap.setBase();
    lastLayout = box;
    return fitBox(box, animate ? 750 : 0);
  }
  stage.onResize(() => current && layout(false));
  let refit = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(refit);
    refit = requestAnimationFrame(() => lastLayout && fitBox(lastLayout, 0));
  });
  document
    .querySelectorAll(".tt-top, .tt-bottom, #hud")
    .forEach((el) => ro.observe(el));

  // ---------------------------------------------------------------- buddy reactions
  function chomp(times = 4) {
    let i = 0;
    const step = () => {
      buddy.mouth(i % 2 ? 0 : 0.9);
      if (++i < times * 2) setTimeout(step, 110);
      else buddy.mouth(0);
    };
    step();
  }
  function poke() {
    buddy.sound();
    chomp(2);
    buddy.setMood("happy", 900);
    buddy.say(pick(t("poke", cap(treatName()))), 1800);
    jar.wobble();
  }

  // ---------------------------------------------------------------- HOME
  const bar = Kit.ui.bar(0, L.MAX_STARS);
  $("#rankBarHost").appendChild(bar);

  function renderHome() {
    planets.setStars(best);
    const s = starsOf(selected);
    $("#selTitle").textContent = t("tableName", selected);
    const ss = $("#selStars");
    ss.innerHTML = [1, 2, 3]
      .map((i) => `<span class="${i <= s ? "on" : ""}">★</span>`)
      .join("");
    ss.setAttribute("aria-label", t("starsOf", s));
    $("#homePanel").style.setProperty("--c", colorOf(selected));
    document
      .querySelectorAll(".tt-mode")
      .forEach((b) => b.style.setProperty("--c", colorOf(selected)));
    $("#learnHint").textContent = t("learnHint", treatName());
    const pro = proUnlocked(selected);
    const btnPro = $("#btnPro");
    btnPro.classList.toggle("locked", !pro);
    btnPro.setAttribute("aria-disabled", String(!pro));
    $("#proEmoji").textContent = pro ? "⌨️" : "🔒";
    $("#proHint").textContent = pro ? t("proHint") : t("proLocked");
    $("#rushOneLabel").textContent = `⚡ ${t("tableShort", selected)}`;
    $("#rushOneBest").textContent = rushBest[selected]
      ? t("rushBest", rushBest[selected])
      : "";
    $("#rushAllBest").textContent = rushBest.all
      ? t("rushBest", rushBest.all)
      : "";
    const total = L.totalStars(best);
    const ri = L.rankIndex(total);
    const ranks = t("ranks");
    $("#rankTitle").textContent = ranks[ri];
    $("#rankStars").textContent = `⭐ ${total} / ${L.MAX_STARS}`;
    bar.set(total, L.MAX_STARS);
    bar.title =
      ri + 1 < L.RANK_AT.length
        ? t("nextRank", L.RANK_AT[ri + 1] - total, ranks[ri + 1])
        : t("maxRank");
    renderBasket();
    jar.fill(treats);
  }
  function renderBasket() {
    $("#basketCount").textContent = treats;
    $("#basket").setAttribute(
      "aria-label",
      t("jarAria", buddyName(), treats, treatName(treats)),
    );
    jarChip.replaceChildren(
      treatEl("treat"),
      document.createTextNode(` ${treats}`),
    );
  }

  function selectTable(n) {
    sfx("tap");
    const changed = n !== selected;
    selected = n;
    KidsStore.save(key("selected"), n);
    renderHome();
    if (changed) planets.select(n);
    planets.wiggle(n);
    const p = planets.planets[n - 1].root.getWorldPosition(new THREE.Vector3());
    buddy.lookAt(p);
    setTimeout(() => buddy.lookAt("pointer"), 1500);
    buddy.setMood("hop", 400);
    buddy.say(`${t("tableName", n)} ✨`, 1800);
  }

  let greetTimer = 0;
  function greet() {
    clearTimeout(greetTimer);
    greetTimer = setTimeout(() => {
      if (current !== "home") return;
      buddy.say(pick(t("hello", buddyName(), treatName())), 3800);
      greetTimer = setTimeout(
        () => current === "home" && buddy.say(t("tapPlanet"), 3500),
        4800,
      );
    }, 500);
  }
  function goHome() {
    stopRush();
    play.hint = false;
    buddy.hush();
    buddy.setMood("idle");
    show("home");
    renderHome();
    planets.select(selected);
    greet();
  }

  $("#btnLearn").addEventListener("click", () => startLearn(selected));
  $("#btnPractice").addEventListener("click", () =>
    startPlay("practice", [selected]),
  );
  $("#btnPro").addEventListener("click", (e) => {
    if (!proUnlocked(selected)) {
      sfx("tap");
      restart(e.currentTarget, "shake");
      buddy.setMood("think", 1400);
      buddy.shake();
      buddy.say(t("proLocked"), 2400);
      return;
    }
    startPlay("pro", [selected]);
  });
  $("#btnRushOne").addEventListener("click", () =>
    startPlay("rush", [selected]),
  );
  $("#btnRushAll").addEventListener("click", () => startPlay("rush", []));
  $("#btnBack").addEventListener("click", () => {
    sfx("tap");
    goHome();
  });

  // ---------------------------------------------------------------- LEARN
  const learn = { n: 1, b: 1 };

  function startLearn(n) {
    sfx("tap");
    learn.n = n;
    learn.b = 1;
    buddy.hush();
    show("learn");
    document.documentElement.style.setProperty("--tc", colorOf(n));
    renderLearn(0);
  }

  function renderLearnText() {
    const { n, b } = learn;
    const ans = n * b;
    $("#learnTitle").textContent = t("learnTitle", n);
    const eq = $("#learnEq");
    eq.innerHTML = `<span>${n}</span> × <span>${b}</span> = <b>${ans}</b>`;
    eq.setAttribute("aria-label", t("say", n, b, ans));
    $("#groupsLabel").textContent = t("groupsOf", b, n);
    $("#skipRow").innerHTML = L.skipCount(n)
      .map(
        (v, i) =>
          `<span class="${i < b - 1 ? "done" : i === b - 1 ? "now" : ""}">${v}</span>`,
      )
      .join("");
    $("#learnStep").textContent = t("step", b);
    $("#learnPrev").disabled = b === 1;
    $("#learnNext").hidden = b === 10;
    $("#learnPractice").hidden = b !== 10;
  }

  // animateFrom: first row that pops in (rows before it are already there).
  function renderLearn(animateFrom, { talk = true, recount = false } = {}) {
    const { n, b } = learn;
    const ans = n * b;
    renderLearnText();
    board.show(n, b, {
      frameRows: 10,
      animateFrom,
      rowMs: recount ? 480 : 420,
      colMs: recount ? 20 : 55,
      onRow: (row, value) => {
        if (current !== "learn") return;
        const last = row === b - 1;
        sfx(last ? "chirp" : "tap");
        buddy.setMood(
          last && b === 10 ? "happy" : "hop",
          last && b === 10 ? 1500 : 380,
        );
        if (last && talk) {
          chomp(2);
          buddy.say(t("explain", n, b, ans, treatName(n)), 0);
          speak(t("say", n, b, ans));
        } else buddy.say(t("count", value), 0);
      },
    });
  }

  function learnStep(d) {
    const nb = learn.b + d;
    if (nb < 1 || nb > 10) return;
    sfx(d > 0 ? "chirp" : "tap");
    learn.b = nb;
    renderLearn(d > 0 ? nb - 1 : nb);
    if (d < 0) {
      buddy.say(t("explain", learn.n, nb, learn.n * nb, treatName(learn.n)), 0);
      buddy.setMood("hop", 380);
    }
    if (nb === 10) setTimeout(() => $("#learnPractice").focus(), 50);
  }
  $("#learnPrev").addEventListener("click", () => learnStep(-1));
  $("#learnNext").addEventListener("click", () => learnStep(1));
  // Read aloud + count every row again with the buddy.
  $("#btnSpeak").addEventListener("click", () => {
    const { n, b } = learn;
    speak(t("say", n, b, n * b));
    buddy.say(t("countAlong"), 0);
    renderLearn(0, { recount: true });
  });
  $("#learnPractice").addEventListener("click", () =>
    startPlay("practice", [learn.n]),
  );

  // ---------------------------------------------------------------- PLAY
  const play = {
    mode: "practice",
    tables: [],
    round: null,
    q: null,
    locked: false,
    earned: 0,
    streak: 0,
    typed: "",
    score: 0,
    bonuses: 0,
    endAt: 0,
    timer: 0,
    started: false,
    hint: false,
    hintBox: null,
    starSpots: null,
    token: 0,
  };

  function startPlay(mode, tables) {
    sfx("tap");
    stopRush();
    Object.assign(play, {
      mode,
      tables,
      locked: true,
      earned: 0,
      streak: 0,
      typed: "",
      score: 0,
      bonuses: 0,
      q: null,
      round: null,
      started: false,
      hint: false,
    });
    play.token++;
    const rush = mode === "rush";
    const n = tables[0];
    document.documentElement.style.setProperty(
      "--tc",
      n ? colorOf(n) : "#ffd84d",
    );
    $("#dots").hidden = rush;
    $("#timer").hidden = !rush;
    $("#timer").classList.remove("hurry");
    $("#rushScore").textContent = "0";
    $("#feedback").textContent = "";
    $("#btnGotIt").hidden = true;
    $("#qCard").classList.remove("good", "oops");
    fire.level = 0;
    renderStreak();
    buddy.hush();
    buddy.setMood("idle");
    jar.fill(0);
    renderBasket();
    show("play");
    renderPlayTitle();
    if (rush) {
      ring.reset();
      ring.set(60, false);
      $("#timerText").textContent = "60";
      $("#question").textContent = t("ready");
      $("#dots").innerHTML = "";
      buddy.setMood("wow", 900);
      rain.rate = 0.9;
      rain.burst(6);
      const token = play.token;
      play.timer = setTimeout(() => {
        if (token !== play.token || current !== "play") return;
        play.started = true;
        play.endAt = performance.now() + RUSH_MS;
        play.timer = setInterval(tickRush, 100);
        play.q = L.rushQuestion(tables, null);
        ask();
      }, 1100);
      return;
    }
    play.round = new PracticeRound(L, n);
    play.q = play.round.next();
    ask();
  }

  function renderPlayTitle() {
    const n = play.tables[0];
    $("#playTitle").textContent =
      play.mode === "rush"
        ? t("rushGameTitle") + (n ? ` · ${t("tableShort", n)}` : "")
        : play.mode === "pro"
          ? t("proTitle", n)
          : t("practiceTitle", n);
  }

  function renderQuestion() {
    const { a, b } = play.q;
    const el = $("#question");
    if (play.mode === "pro") {
      el.innerHTML = `${a} × ${b} = <span class="typed">${play.typed}</span><span class="caret"></span>`;
      el.setAttribute(
        "aria-label",
        `${t("question", a, b)} ${t("typeAnswer")}: ${play.typed}`,
      );
    } else {
      el.textContent = t("question", a, b);
      el.removeAttribute("aria-label");
    }
  }

  function renderDots() {
    const el = $("#dots");
    if (play.mode === "rush" || !play.round) return;
    el.innerHTML = "";
    const done = play.round.solved;
    el.setAttribute("aria-valuenow", String(done));
    el.setAttribute(
      "aria-label",
      t("progressAria", Math.min(done + 1, L.ROUND), L.ROUND),
    );
    for (const f of play.round.facts) {
      const d = document.createElement("span");
      d.className = `tt-dot ${f.state}${play.q && play.q.dot === f.dot && !play.locked ? " now" : ""}`;
      if (f.state === "good") d.appendChild(treatEl("treat"));
      else if (f.state === "fixed") d.textContent = "✓";
      el.appendChild(d);
    }
  }

  function renderStreak() {
    const el = $("#streak");
    if (play.streak >= 2) {
      el.textContent = t("streak", play.streak);
      restart(el, "on");
    } else el.classList.remove("on");
  }

  function ask() {
    if (current !== "play") return;
    play.locked = false;
    play.typed = "";
    play.hint = false;
    hint.group.visible = false;
    $("#btnGotIt").hidden = true;
    $("#feedback").textContent = "";
    $("#qCard").classList.remove("good", "oops");
    renderQuestion();
    restart($("#question"), "in");
    if (play.mode === "pro") keypad.enable(true);
    else bubbles.show(L.choices(play.q.a, play.q.b));
    renderDots();
  }

  function padKey(k) {
    if (play.locked || current !== "play" || play.mode !== "pro") return;
    keypad.press(k);
    const r = padInput(play.typed, k);
    if (k === "✓" && !r.submit) {
      restart($("#qCard"), "shake");
      sfx("tap");
      return;
    }
    if (r.submit) return answer(Number(play.typed), null);
    if (r.typed !== play.typed) sfx("tap");
    play.typed = r.typed;
    renderQuestion();
  }

  function answer(v, i) {
    if (play.locked || !play.q) return;
    if (v === play.q.answer) onRight(v, i);
    else onWrong(v, i);
  }

  function onRight(v, i) {
    const q = play.q;
    play.locked = true;
    sfx("correct");
    play.streak++;
    play.earned++;
    addTreats(1);
    $("#qCard").classList.add("good");
    $("#question").textContent = t("correctIs", q.a, q.b, q.answer);
    let from;
    if (i != null) {
      from = bubbles.pop(i);
      bubbles.lock();
      setTimeout(() => bubbles.clear(260), 160);
    } else {
      from = keypad.group
        .getWorldPosition(new THREE.Vector3())
        .add(new THREE.Vector3(0, 2.2, 0.5));
      keypad.enable(false);
      stage.burst(from, { shape: "star", count: 14 });
    }
    flyTreat(from);
    buddy.setMood("happy", 900);
    const praise =
      play.streak >= 3 && play.streak % 3 === 0
        ? t("streakSay", play.streak)
        : pick(t("praise"));
    buddy.say(praise, 1100);
    renderStreak();
    fire.level = play.streak >= 3 ? play.streak : 0;
    if (play.streak >= 3 && play.streak % 3 === 0)
      stage.burst(buddyRig.localToWorld(new THREE.Vector3(0, 0.3, 0)), {
        shape: "dot",
        count: 20,
        colors: ["#ff922b", "#ffd43b", "#ff6b6b"],
        up: 4,
      });

    const token = play.token;
    if (play.mode === "rush") {
      play.score++;
      $("#rushScore").textContent = play.score;
      restart($("#scorePill"), "pop");
      rain.burst(2);
      if (rushBonusDue(play.streak, play.bonuses)) rushBonus();
      setTimeout(() => token === play.token && nextRush(), 600);
      return;
    }
    play.round.answer(v);
    renderDots();
    setTimeout(() => token === play.token && nextPractice(), 950);
  }

  function onWrong(v, i) {
    const q = play.q;
    play.locked = true;
    sfx("wrong");
    play.streak = 0;
    fire.level = 0;
    renderStreak();
    $("#qCard").classList.add("oops");
    $("#question").textContent = t("correctIs", q.a, q.b, q.answer);
    if (i != null) {
      bubbles.lock();
      bubbles.wrong(i);
      const right = bubbles.indexOf(q.answer);
      if (right >= 0) bubbles.reveal(right);
    } else {
      keypad.enable(false);
      restart($("#qCard"), "shake");
    }
    buddy.setMood("think", 2200);
    buddy.shake();
    const oops = pick(t("oops"));
    buddy.say(oops, 2400);
    const token = play.token;
    if (play.mode === "rush") {
      $("#feedback").textContent = oops;
      setTimeout(() => token === play.token && nextRush(), 1150);
      return;
    }
    // Practice / Pro: the treat array appears as the hint; asked again later.
    const res = play.round.answer(v);
    $("#feedback").textContent =
      t("hintLine", q.a, q.b, q.answer) + (res.retry ? ` · ${t("again")}` : "");
    renderDots();
    setTimeout(
      () => {
        if (token !== play.token || current !== "play") return;
        if (i != null) bubbles.clear();
        showHint(q);
      },
      i != null ? 850 : 450,
    );
    const got = $("#btnGotIt");
    got.hidden = false;
    setTimeout(() => got.focus({ preventScroll: true }), 30);
  }

  function showHint(q) {
    play.hint = true;
    if (play.mode === "pro") keypad.group.visible = false;
    hint.group.visible = true;
    const box = play.hintBox;
    hint.show(q.a, q.b, {
      fit: { w: box.w, h: box.h },
      frameRows: q.b,
      rowMs: Math.min(320, 1800 / q.b),
      colMs: Math.min(40, 300 / q.a),
      onRow: (row, value) => {
        if (current !== "play" || !play.hint) return;
        sfx("tap");
        buddy.say(
          row === q.b - 1
            ? t("hintLine", q.a, q.b, q.answer)
            : t("count", value),
          0,
        );
        buddy.setMood("hop", 300);
      },
    });
    pop(stage, hint.group, { from: 0.5, ms: 450 });
  }

  $("#btnGotIt").addEventListener("click", () => {
    sfx("tap");
    nextPractice();
  });

  function nextPractice() {
    if (current !== "play" || !play.round) return;
    buddy.hush();
    if (play.hint) {
      play.hint = false;
      hint.group.visible = false;
      if (play.mode === "pro") {
        keypad.group.visible = true;
        pop(stage, keypad.group, { from: 0.6, ms: 400 });
      }
    }
    if (play.round.done) return finishPractice();
    play.q = play.round.next();
    ask();
  }

  // A treat flies from the answer into the jar; the buddy munches.
  function flyTreat(from) {
    const land = () => {
      jar.add();
      renderBasket();
      chomp(3);
    };
    if (stage.reducedMotion || !flyer) return land();
    const to = jar.mouth();
    const mid = from.clone().lerp(to, 0.5);
    mid.y = Math.max(from.y, to.y) + 2.2;
    mid.z += 1.2;
    const curve = new THREE.QuadraticBezierCurve3(from.clone(), mid, to);
    flyer.visible = true;
    stage.tween({
      ms: 620,
      ease: "inOutQuad",
      onUpdate: (k) => {
        curve.getPoint(k, flyer.position);
        flyer.rotation.set(k * 7, k * 5, 0);
        flyer.scale.setScalar(0.9 - 0.4 * k);
      },
      onDone: () => {
        flyer.visible = false;
        land();
      },
    });
  }

  // ---------------------------------------------------------------- rush
  function tickRush() {
    const left = Math.max(0, play.endAt - performance.now());
    const secs = Math.ceil(left / 1000);
    ring.set(secs, secs <= 10);
    const txt = $("#timerText");
    if (txt.textContent !== String(secs)) {
      txt.textContent = secs;
      txt.setAttribute("aria-label", t("timeLeft", secs));
      if (secs <= 5 && secs > 0) sfx("tap");
    }
    $("#timer").classList.toggle("hurry", secs <= 10);
    if (left <= 0) finishRush();
  }

  function rushBonus() {
    play.bonuses++;
    play.endAt += BONUS_MS;
    sfx("level");
    const b = document.createElement("div");
    b.className = "tt-bonus";
    b.textContent = t("timeBonus");
    $("#qCard").appendChild(b);
    setTimeout(() => b.remove(), 1200);
    rain.burst(14);
    ring.flash();
  }

  function nextRush() {
    if (current !== "play" || !play.started) return;
    play.q = L.rushQuestion(play.tables, play.q);
    ask();
  }

  function stopRush() {
    clearTimeout(play.timer);
    clearInterval(play.timer);
    play.timer = 0;
    play.started = false;
    rain.rate = 0;
  }

  // ---------------------------------------------------------------- keyboard
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector(".kit-dialog")) return;
    if (current === "learn") {
      if (e.key === "ArrowRight") learnStep(1);
      if (e.key === "ArrowLeft") learnStep(-1);
      return;
    }
    if (current !== "play" || !play.q || play.locked) return;
    if (play.mode === "pro") {
      if (/^[0-9]$/.test(e.key)) padKey(e.key);
      else if (e.key === "Backspace") padKey("⌫");
      else if (e.key === "Enter") {
        e.preventDefault();
        padKey("✓");
      }
      return;
    }
    if (/^[1-4]$/.test(e.key)) {
      const i = Number(e.key) - 1;
      const b = bubbles.bubbles[i];
      if (b.root.visible) answer(b.value, i);
    }
  });

  // ---------------------------------------------------------------- RESULTS
  let last = null;

  function finishPractice() {
    const n = play.tables[0];
    const stars = play.round.stars;
    const prev = starsOf(n);
    if (stars > prev) {
      best[n] = stars;
      saveStars();
    }
    last = {
      mode: play.mode,
      tables: play.tables,
      n,
      stars,
      firstTry: play.round.firstTry,
      earned: play.earned,
      proNew: prev < 2 && stars >= 2,
      masterNew: prev < 3 && stars === 3,
    };
    showResults();
  }

  function finishRush() {
    const k = play.tables[0] || "all";
    stopRush();
    play.locked = true;
    const prevBest = rushBest[k] || 0;
    const record = play.score > prevBest;
    if (record) {
      rushBest[k] = play.score;
      KidsStore.save(key("rushBest"), rushBest);
    }
    last = {
      mode: "rush",
      tables: play.tables,
      score: play.score,
      best: Math.max(prevBest, play.score),
      record: record && play.score > 0,
      earned: play.earned,
    };
    showResults();
  }

  function showResults() {
    const earned = play.earned;
    buddy.hush();
    show("results");
    layout(false);
    jar.fill(earned);
    renderBasket();
    renderResults(true);
  }

  function renderResults(animate) {
    const r = last;
    if (!r) return;
    const rush = r.mode === "rush";
    const badges = [];
    if (r.earned)
      badges.push(
        t("treatsEarned", r.earned, treatName(r.earned), buddyName()),
      );
    const spots = resultsLayout(stage.size.aspect).stars;
    if (rush) {
      $("#resultLine").textContent = t("resultRush", r.score);
      $("#resultSub").textContent =
        (r.record ? `${t("newRecord")} · ` : "") + t("rushBestLine", r.best);
      $("#starsSr").textContent = "";
      const lvl = r.record ? 2 : r.score >= 10 ? 1 : 0;
      if (animate) {
        podium.showScore(`⭐ ${r.score}`, {
          x: 0,
          y: spots[1].y - 0.2,
          z: 0.2,
        });
        buddy.setMood(lvl ? "happy" : "hop", lvl ? 0 : 500);
        if (lvl === 2) {
          sfx("fanfare");
          setTimeout(() => current === "results" && stage.confetti(), 500);
        } else sfx("level");
      }
      buddy.say(t("rushLines")[lvl], 0);
    } else {
      $("#resultLine").textContent = t("resultPractice", r.firstTry, L.ROUND);
      $("#resultSub").textContent = "";
      $("#starsSr").textContent = t("stars", r.stars);
      if (r.proNew) badges.push(t("proUnlocked"));
      if (r.masterNew) badges.push(t("master", r.n));
      if (animate) {
        podium.showStars(spots, r.stars, {
          onStar: (i, got) => current === "results" && got && sfx("star"),
        });
        setTimeout(
          () => {
            if (current === "results" && r.stars >= 2) {
              sfx("fanfare");
              stage.confetti();
              buddy.celebrate();
            }
          },
          500 + 3 * 450 + 400,
        );
        buddy.setMood(r.stars >= 2 ? "happy" : "hop", r.stars >= 2 ? 0 : 500);
      }
      buddy.say(t("results", cap(treatName(1)), treatName())[r.stars], 0);
    }
    const bEl = $("#badges");
    bEl.innerHTML = "";
    badges.forEach((text, i) => {
      const b = document.createElement("span");
      b.className = "tt-badge";
      if (i === 0 && r.earned) b.appendChild(treatEl("treat"));
      b.append(text);
      bEl.appendChild(b);
    });
    if (animate)
      setTimeout(() => $("#btnAgain").focus({ preventScroll: true }), 60);
  }

  $("#btnAgain").addEventListener("click", () => {
    if (!last) return goHome();
    startPlay(last.mode, last.tables);
  });
  $("#btnTables").addEventListener("click", () => {
    sfx("tap");
    goHome();
  });

  // ---------------------------------------------------------------- language & buddy
  function renderStatic() {
    KidsI18n.apply(DICT);
    document.title = `${t("docTitle", buddyName())} 3D`;
    document
      .querySelectorAll("[data-treat]")
      .forEach((slot) => slot.replaceChildren(treatEl("treat")));
    buddyTap.refreshLabel();
    keypad.refreshLabels();
  }
  function rerender() {
    renderStatic();
    renderBasket();
    if (current === "home") {
      renderHome();
      greet();
    } else if (current === "learn") {
      renderLearnText();
      buddy.say(
        t("explain", learn.n, learn.b, learn.n * learn.b, treatName(learn.n)),
        0,
      );
    } else if (current === "play") {
      renderPlayTitle();
      if (play.q && !play.locked) renderQuestion();
      renderDots();
      renderStreak();
    } else if (current === "results") {
      renderResults(false);
    }
    requestAnimationFrame(() => lastLayout && fitBox(lastLayout, 0));
  }
  KidsI18n.onChange(rerender);
  Mascots.onBuddyChange((id) => {
    buddyId = id;
    setBuddyTreat();
    if (current === "home") jar.fill(treats);
    else if (current === "results" || current === "play") jar.fill(play.earned);
    rerender();
    setTimeout(() => {
      buddy.sound();
      buddy.setMood("hop", 500);
    }, 60);
  });

  // ---------------------------------------------------------------- boot
  window.__tt = {
    stage,
    buddy: () => buddy,
    get screen() {
      return current;
    },
    play,
    learn,
    planets,
    bubbles,
    keypad,
    board,
    hint,
    jar,
    screenOf: (obj) =>
      stage.toScreen(obj.getWorldPosition(new THREE.Vector3())),
  };
  renderStatic();
  current = null;
  show("home");
  renderHome();
  planets.select(selected);
  greet();
  setTimeout(() => {
    buddy.setMood("hop", 450);
    buddy.sound();
  }, 700);
}
