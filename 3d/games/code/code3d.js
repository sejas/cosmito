// Code 3D: the wordless coding game as floating toy dioramas.
// Rules, levels and texts are the 2D game's (games/code/js: CodeEngine,
// CODE_LEVELS, CODE_I18N), so progress is shared: same KidsStore keys.
/* global CodeEngine, CODE_LEVELS, CODE_WORLDS, CODE_I18N, KidsI18n, KidsStore, KidsAudio, Mascots */
import * as THREE from "three";
import * as Kit from "../../kit/kit.js";
import {
  fitPoints,
  boxPoints,
  ellipsePoints,
  hintPath,
  nextLevel,
  worldStars,
  hopRoute,
  stepMs,
} from "./logic.js";
import { createBoard, PAD_COLORS } from "./board.js";
import { createWalker } from "./walker.js";
import { createMap } from "./map3d.js";

const E = CodeEngine;
const LEVELS = CODE_LEVELS;
const WORLDS = CODE_WORLDS;
const GAME = "code";
const MAX_STARS = LEVELS.length * 3;
const SPEEDS = { slow: 680, fast: 300 };

// Texts: the kit's + the 2D game's + a few for the 3D map.
const EXTRA = {
  en: {
    classicShort: "2D",
    goWorld: (name) => `Go to ${name}`,
    worldsLabel: "Worlds",
    prevWorld: "Previous world",
    nextWorld: "Next world",
    worldTab: (name, got, max, open) =>
      `${name}, ${got} of ${max} stars${open ? "" : ", locked"}`,
    total: (n, max) => `⭐ ${n} / ${max}`,
    buddyPoke: (name) => `${name}. Tap to say hi`,
    letsGo: "Let's go! 🚀",
    docTitle3d: (name) => `Code with ${name} 3D`,
  },
  es: {
    classicShort: "2D",
    goWorld: (name) => `Ir a ${name}`,
    worldsLabel: "Mundos",
    prevWorld: "Mundo anterior",
    nextWorld: "Mundo siguiente",
    worldTab: (name, got, max, open) =>
      `${name}, ${got} de ${max} estrellas${open ? "" : ", bloqueado"}`,
    total: (n, max) => `⭐ ${n} / ${max}`,
    buddyPoke: (name) => `${name}. Tócalo para saludar`,
    letsGo: "¡Vamos! 🚀",
    docTitle3d: (name) => `Programa con ${name} 3D`,
  },
};
const DICT = {};
for (const lang of ["en", "es"])
  DICT[lang] = { ...Kit.KIT_DICT[lang], ...CODE_I18N[lang], ...EXTRA[lang] };
const t = KidsI18n.translator(DICT);

const $ = (s) => document.querySelector(s);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const pick = (a) =>
  Array.isArray(a) ? a[Math.floor(Math.random() * a.length)] : a;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const restart = (el, cls) => {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
};
const ARROW =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 21 12h-5.2v9.5H8.2V12H3z"/></svg>';
const LOOP =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3l4 4-4 4V8H7a2 2 0 0 0-2 2v2H2v-2a5 5 0 0 1 5-5h10zM7 21l-4-4 4-4v3h10a2 2 0 0 0 2-2v-2h3v2a5 5 0 0 1-5 5H7z"/></svg>';

// ---------- shared progress (same keys as the 2D game) ----------
const key = (k) => `${GAME}.${k}`;
const best = KidsStore.load(key("best"), {});
let speed = KidsStore.load(key("speed"), "slow");
if (!SPEEDS[speed]) speed = "slow";
function saveBest() {
  KidsStore.save(key("best"), best);
  KidsStore.setProgress(GAME, E.totalStars(best), MAX_STARS);
}
KidsStore.setProgress(GAME, E.totalStars(best), MAX_STARS);
const starsOf = (i) => Math.min(3, best[LEVELS[i].id] || 0);
const isOpen = (i) => E.unlocked(LEVELS, best, i);

// ---------- chips (work without WebGL too) ----------
Kit.ui.buddyChip($("#btnBuddy"), "pipo");
Kit.ui.langChip($("#btnLang"));
Kit.ui.soundChip($("#btnSound"));
let buddyId = Mascots.buddy("pipo");
const def = () => Mascots.get(buddyId);
const buddyName = () => KidsI18n.pickLang(def().name);
const treatName = (n = 2) => Mascots.treatName(def(), n);

// ---------- sound & voice ----------
document.addEventListener("pointerdown", () => KidsAudio.ensure(), true);
document.addEventListener("keydown", () => KidsAudio.ensure(), true);
const sfx = (name) => KidsAudio.sfx(name);
const blip = (midi, dur = 0.09, type = "sine") => {
  const ctx = KidsAudio.ctx();
  if (ctx) KidsAudio.tone(midi, ctx.currentTime, dur, 0.1, type);
};
// The buddy reads its bubbles aloud for pre-readers (emoji are not spoken).
function speak(text) {
  if (KidsAudio.isMuted() || !("speechSynthesis" in window)) return;
  try {
    const clean = text
      .replace(
        /[\p{Extended_Pictographic}\u{FE0F}\u{20E3}\u{1F1E6}-\u{1F1FF}↶↺▶⏹★]/gu,
        "",
      )
      .trim();
    if (!clean) return;
    const lang = KidsI18n.get() === "es" ? "es-ES" : "en-US";
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = lang;
    u.rate = 0.95;
    u.pitch = 1.25;
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
const live = (text) => {
  $("#live").textContent = "";
  requestAnimationFrame(() => ($("#live").textContent = text));
};

const stage = Kit.createStage({
  fallback: "../../../games/code/",
  parallax: 0.3,
  fov: 38,
  sky: { top: "#6fb8ff", middle: "#c4e8ff", bottom: "#d8d0ff" },
});

if (!stage) {
  // No WebGL: the kit shows a card linking to the 2D game; keep the header alive.
  KidsI18n.apply(DICT);
  KidsI18n.onChange(() => KidsI18n.apply(DICT));
} else {
  start();
}

function start() {
  Kit.createClouds(stage.scene, {
    count: 10,
    center: [0, 1, -34],
    area: [90, 12, 26],
  });
  Kit.createSparkles(stage.scene, {
    count: 60,
    center: [0, 4.5, -4],
    area: [30, 4, 14],
  });

  const buddy = Kit.buddyMascot(stage, "pipo");
  const walker = createWalker(stage, buddy);
  stage.scene.add(walker.root);
  // Keep the speech bubble on screen (the kit pins it centred over the head).
  const headV = new THREE.Vector3();
  stage.onFrame(() => {
    const el = buddy.bubbleEl;
    if (!el) return;
    if (!el.classList.contains("show")) {
      if (el.style.translate) el.style.translate = "";
      return;
    }
    const sp = stage.toScreen(buddy.anchor.getWorldPosition(headV));
    const half = el.offsetWidth / 2;
    const pad = 10;
    let dx = 0;
    if (sp.x - half < pad) dx = pad - (sp.x - half);
    else if (sp.x + half > innerWidth - pad) dx = innerWidth - pad - (sp.x + half);
    el.style.translate = `${Math.round(dx)}px 0`;
  });
  const say = (text, ms = 3000) => {
    buddy.say(text, ms);
    speak(text);
  };
  function chomp(times = 3) {
    let i = 0;
    const step = () => {
      buddy.mouth(i % 2 ? 0 : 0.9);
      if (++i < times * 2) setTimeout(step, 110);
      else buddy.mouth(0);
    };
    step();
  }
  const buddyTap = stage.tap(buddy.object, {
    label: () => t("buddyPoke", buddyName()),
    onTap: () => {
      if (runState) return;
      if (mode === "map") return pickStone(standing);
      buddy.celebrate(900);
      chomp(2);
      say(pick(t("poke")), 1800);
    },
  });

  // ---------- state ----------
  let mode = "map";
  let busy = false; // a transition is running
  let focusWorld = 0;
  let standing = nextLevel(E, LEVELS, best);
  let li = 0;
  let L = null;
  let world = null;
  let board = null;
  let solution = [];
  let prog = [];
  let cursor = { parent: "", index: 0 };
  let undoStack = [];
  let fails = 0;
  let hintOn = false;
  let failPath = null;
  let runState = null;
  let resetTimer = 0;
  let cell = { x: 0, y: 0 };
  let podium = null;
  let winView = false;

  // ---------- map ----------
  const map = createMap(stage, {
    worlds: WORLDS,
    levels: LEVELS,
    t,
    onStone: (i) => pickStone(i),
    onIsland: (wi) => {
      if (mode === "map" && !busy && wi !== focusWorld) {
        sfx("tap");
        focusIsland(wi, true);
      }
    },
  });

  // Drop leftover confetti/bursts when the scene changes (kit has no clear()).
  const clearParticles = () => {
    for (const p of Object.values(stage.particles.pools || {})) for (const b of p.bits) b.age = b.life;
  };
  const fade = async (on) => {
    $("#fade").classList.toggle("on", on);
    await wait(reduced() ? 60 : 300);
  };

  function setMode(m) {
    mode = m;
    document.body.classList.toggle("mode-map", m === "map");
    document.body.classList.toggle("mode-play", m === "play");
    $("#mapHud").hidden = m !== "map";
    $("#playHud").hidden = m !== "play";
    map.setActive(m === "map");
    if (board) board.root.visible = m === "play";
  }

  function renderMap() {
    map.render({ best, isOpen, current: nextLevel(E, LEVELS, best), standing });
    const w = WORLDS[focusWorld];
    const s = worldStars(E, LEVELS, best, focusWorld);
    document.documentElement.style.setProperty("--wc", w.color);
    $("#worldIcon").textContent = w.icon;
    $("#worldName").textContent = t(`worlds.${w.id}`);
    $("#worldAbout").textContent = t(`worldAbout.${w.id}`);
    $("#worldStars").textContent = s.open ? `⭐ ${s.got}/${s.max}` : "🔒";
    $("#totalStars").textContent = t("total", E.totalStars(best), MAX_STARS);
    const tabs = $("#worldTabs");
    tabs.innerHTML = "";
    WORLDS.forEach((wd, wi) => {
      const ws = worldStars(E, LEVELS, best, wi);
      const b = document.createElement("button");
      b.type = "button";
      b.className = `c3-tab${ws.open ? "" : " locked"}`;
      b.style.setProperty("--wc", wd.color);
      b.innerHTML = `<span aria-hidden="true">${wd.icon}</span>`;
      if (ws.open) {
        const st = document.createElement("span");
        st.className = "c3-tabstars";
        st.setAttribute("aria-hidden", "true");
        st.textContent = `${ws.got}★`;
        b.appendChild(st);
      }
      b.setAttribute(
        "aria-label",
        t("worldTab", t(`worlds.${wd.id}`), ws.got, ws.max, ws.open),
      );
      if (wi === focusWorld) b.setAttribute("aria-current", "true");
      b.addEventListener("click", () => {
        sfx("tap");
        if (!ws.open) say(t("lockedSay"), 2200);
        focusIsland(wi, true);
      });
      tabs.appendChild(b);
    });
    $("#btnPrevWorld").disabled = focusWorld === 0;
    $("#btnNextWorld").disabled = focusWorld === WORLDS.length - 1;
    document.title = t("docTitle3d", buddyName());
  }
  $("#btnPrevWorld").addEventListener("click", () =>
    focusIsland(focusWorld - 1, true),
  );
  $("#btnNextWorld").addEventListener("click", () =>
    focusIsland(focusWorld + 1, true),
  );

  function focusIsland(wi, animate) {
    if (wi < 0 || wi >= WORLDS.length || busy) return;
    const changed = wi !== focusWorld;
    focusWorld = wi;
    renderMap();
    reframe(animate && changed ? 850 : 0);
  }

  // Where the HUD leaves the screen free (CSS px insets).
  function freeRect() {
    const W = innerWidth;
    const H = innerHeight;
    const r = { left: 8, top: 0, right: 8, bottom: 8 };
    const head = $(".c3-head").getBoundingClientRect();
    r.top = head.bottom + 8;
    if (mode === "map") {
      r.top = $("#worldTitle").getBoundingClientRect().bottom + 6;
      r.bottom = H - $("#worldBar").getBoundingClientRect().top + 30;
    } else if (winView) {
      const card = $(".c3-wincard").getBoundingClientRect();
      r.top = head.bottom + 4;
      r.bottom = H - card.top + 4;
      const dock = $("#dock").getBoundingClientRect();
      if (dock.left > W / 2) r.right = W - dock.left + 8;
    } else {
      r.top = $(".c3-playbar").getBoundingClientRect().bottom + 6;
      const dock = $("#dock").getBoundingClientRect();
      if (dock.left > W / 2) r.right = W - dock.left + 12;
      else r.bottom = H - dock.top + 8;
    }
    return r;
  }

  function viewFor() {
    const base = { fov: stage.camera.fov, viewW: innerWidth, viewH: innerHeight, rect: freeRect() };
    if (mode === "map") {
      const a = map.islandArea(focusWorld);
      const c = a.center;
      const points = [
        ...ellipsePoints(c, a.width / 2, a.depth / 2, [-0.5, 0.2]),
        ...ellipsePoints(c, a.width * 0.4, a.depth * 0.4, [1.7], 8),
      ];
      return fitPoints({ ...base, points, elevation: map.wide ? 38 : 48, margin: 1.02 });
    }
    if (winView) {
      const g = board.goalPos();
      const points = boxPoints([g.x - 1.25, g.y - 0.1, g.z - 0.5], [g.x + 1.25, g.y + 2.45, g.z + 0.5]);
      return fitPoints({ ...base, points, elevation: 20, margin: 1.06 });
    }
    const W = world.w + 0.7;
    const H = world.h + 0.7;
    const points = boxPoints([-W / 2, -0.35, -H / 2], [W / 2, 0.95, H / 2]);
    const tall = innerHeight > innerWidth * 1.2;
    return fitPoints({ ...base, points, elevation: tall ? 60 : 55, margin: 1.03 });
  }
  // Camera moves: a newer move always wins over one still running (the
  // kit's setView tweens can't be cancelled, so we drive it ourselves).
  let camToken = 0;
  function camTo(view, ms = 0, ease = "inOutCubic") {
    const my = ++camToken;
    if (!ms || reduced()) return stage.setView(view);
    const p0 = stage.view.position.clone();
    const t0 = stage.view.target.clone();
    const p1 = new THREE.Vector3(...view.position);
    const t1 = new THREE.Vector3(...view.target);
    const p = new THREE.Vector3();
    const q = new THREE.Vector3();
    return stage.tween({
      ms,
      ease,
      onUpdate: (k) => {
        if (my !== camToken) return;
        p.lerpVectors(p0, p1, k);
        q.lerpVectors(t0, t1, k);
        stage.setView({ position: p.toArray(), target: q.toArray() });
      },
    }).done;
  }
  function reframe(ms = 0) {
    if (mode === "play" && !board) return Promise.resolve();
    return camTo(viewFor(), ms);
  }
  stage.onResize((w, h, aspect) => {
    map.layout(aspect >= 1.1);
    if (mode === "map") placeOnStone(standing);
    reframe();
  });
  // Re-frame when the dock grows or shrinks (program wraps to a new row).
  let lastDock = 0;
  new ResizeObserver(() => {
    const hgt = Math.round($("#dock").getBoundingClientRect().height);
    if (mode === "play" && !winView && Math.abs(hgt - lastDock) > 6)
      reframe(lastDock ? 300 : 0);
    lastDock = hgt;
  }).observe($("#dock"));

  function placeOnStone(i) {
    walker.setScale(0.5);
    walker.place(map.stoneTop(i));
    walker.face(null);
  }

  async function pickStone(i) {
    if (mode !== "map" || busy) return;
    if (!isOpen(i)) {
      sfx("wrong");
      buddy.shake();
      map.bounce(i);
      say(t("lockedSay"), 2200);
      return;
    }
    busy = true;
    sfx("tap");
    hushVoice();
    buddy.hush();
    const from = standing;
    const sameIsland = LEVELS[from].world === LEVELS[i].world;
    if (LEVELS[i].world !== focusWorld) {
      focusWorld = LEVELS[i].world;
      renderMap();
      await reframe(600);
    }
    if (sameIsland && !reduced()) {
      for (const k of hopRoute(from, i)) {
        const to = map.stoneTop(k);
        const d = to.clone().sub(walker.root.position);
        walker.face(
          Math.abs(d.x) > Math.abs(d.z)
            ? d.x > 0
              ? "R"
              : "L"
            : d.z > 0
              ? "D"
              : "U",
        );
        blip(72 + (k % 5) * 2, 0.07);
        await walker.hop(to, 190, 0.35);
      }
    } else if (from !== i) {
      await walker.home(map.stoneTop(i), 650);
    }
    standing = i;
    walker.face(null);
    buddy.setMood("hop", 500);
    sfx("level");
    const p = map.stoneTop(i);
    stage.burst(p.clone().setY(p.y + 0.4), { shape: "star", count: 18 });
    await camTo(
      { position: [p.x, p.y + 2.2, p.z + 2.4], target: [p.x, p.y + 0.3, p.z] },
      reduced() ? 0 : 520,
      "inCubic",
    );
    await fade(true);
    openLevel(i);
    await fade(false);
    busy = false;
  }

  async function goMap(message) {
    if (busy) return;
    busy = true;
    closeWin();
    abortRun();
    hushVoice();
    buddy.hush();
    await fade(true);
    standing = li;
    focusWorld = LEVELS[standing].world;
    clearParticles();
    setMode("map");
    renderMap();
    placeOnStone(standing);
    buddy.setMood("idle");
    reframe(0);
    await fade(false);
    busy = false;
    setTimeout(
      () => say(message || pick(t("hello", buddyName(), treatName())), 4000),
      250,
    );
  }

  // ---------- level ----------
  function openLevel(i) {
    closeWin();
    abortRun();
    li = i;
    L = LEVELS[i];
    world = E.parseLevel(L);
    solution = E.fromCompact(L.solution);
    prog = L.start ? E.fromCompact(L.start) : [];
    cursor = { parent: "", index: prog.length };
    undoStack = [];
    fails = 0;
    hintOn = !!L.tutor;
    failPath = null;
    board?.dispose();
    clearParticles();
    board = createBoard(stage, {
      world,
      level: L,
      color: WORLDS[L.world].color,
      buddyId,
    });
    stage.scene.add(board.root);
    setMode("play");
    document.documentElement.style.setProperty("--wc", WORLDS[L.world].color);
    renderTitle();
    renderProgram();
    walker.setScale(0.44);
    resetWalker(true);
    buddy.setMood("idle");
    buddy.hush();
    lastDock = Math.round($("#dock").getBoundingClientRect().height);
    // swoop in from above
    const f = viewFor();
    if (!reduced()) {
      camTo({
        position: [f.position[0], f.position[1] + 5, f.position[2] + 4],
        target: f.target,
      });
      camTo(f, 900, "outCubic");
    } else camTo(f);
    const tip = L.tip ? t(`tips.${L.tip}`, treatName(1)) : null;
    const lvl = L;
    setTimeout(() => {
      if (L === lvl && mode === "play" && !runState) {
        buddy.setMood("hop", 700);
        say(
          tip || pick(t("hello", buddyName(), treatName()).filter((_, k) => k !== 1)), // not "pick a level"
          tip ? 5000 : 3000,
        );
      }
    }, 650);
  }

  function renderTitle() {
    const w = WORLDS[L.world];
    const s = starsOf(li);
    const el = $("#playTitle");
    el.innerHTML = "";
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = w.icon;
    const name = document.createElement("span");
    name.className = "c3-lname";
    name.textContent = t("levelTitle", t(`worlds.${w.id}`), L.num);
    const st = document.createElement("span");
    st.className = "stars";
    st.setAttribute("aria-label", t("levelAria", L.id, s));
    st.innerHTML = [0, 1, 2]
      .map(
        (k) => `<span class="${k < s ? "on" : ""}" aria-hidden="true">★</span>`,
      )
      .join("");
    el.append(icon, name, st);
    document.title = t("docTitle3d", buddyName());
  }

  function resetWalker(instant = false) {
    clearTimeout(resetTimer);
    resetTimer = 0;
    if (!board) return;
    cell = { ...world.start };
    board.resetGems();
    board.hideBug();
    board.showTreat();
    const home = board.pos(world.start.x, world.start.y);
    if (instant) {
      walker.place(home);
      walker.face(null);
    } else {
      walker.home(home, 650);
    }
    buddy.setMood("idle");
  }

  // ---------- blocks ----------
  const blockName = (b) =>
    b.t === "move"
      ? t("blockMove", t(`dirs.${b.d}`))
      : b.t === "repeat"
        ? t("blockRepeat", b.n)
        : t("blockIf", t(`colours.${b.c}`));
  const tokenBlock = (tok) =>
    E.DIRS[tok]
      ? { t: "move", d: tok }
      : tok === "repeat"
        ? { t: "repeat", n: 2 }
        : { t: "if", c: tok.slice(3) };
  const sameKind = (a, b) =>
    a.t === b.t &&
    (a.t === "move" ? a.d === b.d : a.t === "if" ? a.c === b.c : true);
  function face(b, withCount = true) {
    if (b.t === "move") return `<span class="arrow dir-${b.d}">${ARROW}</span>`;
    if (b.t === "repeat")
      return `<span class="loop-ico">${LOOP}</span>${withCount && b.n ? `<span class="times">×${b.n}</span>` : ""}`;
    return `<span class="pad-ico pad-${b.c}"></span><span class="q">?</span>`;
  }
  const kindClass = (b) =>
    b.t === "move"
      ? `blk-move dir-${b.d}`
      : `blk-${b.t}${b.c ? ` c-${b.c}` : ""}`;
  const currentHint = () => (hintOn && L ? E.hint(prog, solution) : null);
  const atPos = (a, parent, index) =>
    a && a.parent === parent && a.index === index;

  function renderPalette() {
    const root = $("#palette");
    root.innerHTML = "";
    const h = currentHint();
    L.palette.forEach((tok) => {
      const b = tokenBlock(tok);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `blk pal ${kindClass(b)}`;
      btn.innerHTML = face(b, false);
      btn.setAttribute(
        "aria-label",
        t("add", b.t === "repeat" ? t("blockRepeatNew") : blockName(b)),
      );
      if (h && h.type === "add" && sameKind(h.block, b))
        btn.classList.add("hint-pulse");
      btn.addEventListener("click", () => addBlock(b));
      root.appendChild(btn);
    });
  }

  function renderProgram() {
    cursor = E.fixCursor(prog, cursor);
    const h = currentHint();
    const root = $("#program");
    root.innerHTML = "";
    renderList(root, prog, "", h);
    if (failPath != null) {
      const el = elAt(failPath);
      if (el) {
        el.classList.add("failed");
        restart(el, "shake");
      }
    }
    if (h && h.type === "remove") elAt(h.path)?.classList.add("hint-x");
    if (h && h.type === "count")
      $(`#program .box[data-path="${h.path}"] .count`)?.classList.add(
        "hint-pulse",
      );
    renderPalette();
    renderControls();
    board?.setHintPath(hintOn ? hintPath(E, world, solution) : null);
  }
  const elAt = (path) => {
    const box = $(`#program .box[data-path="${path}"]`);
    return box
      ? box.querySelector(".box-head")
      : $(`#program .blk[data-path="${path}"]`);
  };
  function renderList(root, list, parent, h) {
    const ghostAt = h && h.type === "add" && h.parent === parent ? h.index : -1;
    for (let i = 0; i <= list.length; i++) {
      if (i === ghostAt) root.appendChild(ghostEl(h));
      else if (atPos(cursor, parent, i))
        root.appendChild(slotEl(parent, i, true));
      else if (i === list.length) root.appendChild(slotEl(parent, i, false));
      if (i < list.length)
        root.appendChild(
          blockEl(list[i], parent === "" ? String(i) : `${parent}.${i}`, h),
        );
    }
  }
  function slotEl(parent, index, active) {
    const s = document.createElement("button");
    s.type = "button";
    s.className = `slot${active ? " cursor" : ""}`;
    s.setAttribute("aria-label", t("slot"));
    if (active) s.setAttribute("aria-current", "true");
    s.addEventListener("click", () => {
      if (runState) return;
      cursor = { parent, index };
      sfx("tap");
      renderProgram();
    });
    return s;
  }
  function ghostEl(h) {
    const g = document.createElement("button");
    g.type = "button";
    g.className = `blk ghost ${kindClass(h.block)}`;
    g.innerHTML = face(h.block);
    g.setAttribute("aria-label", t("ghost", blockName(h.block)));
    g.addEventListener("click", () => addBlock(h.block));
    return g;
  }
  function blockEl(b, path) {
    if (b.t === "move") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `blk prog ${kindClass(b)}`;
      btn.dataset.path = path;
      btn.innerHTML = face(b);
      btn.setAttribute("aria-label", t("remove", blockName(b)));
      btn.addEventListener("click", () => removeBlock(path));
      return btn;
    }
    const box = document.createElement("div");
    box.className = `box ${kindClass(b)}`;
    box.dataset.path = path;
    const head = document.createElement("div");
    head.className = "box-top";
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "box-head";
    rm.innerHTML =
      b.t === "repeat" ? `<span class="loop-ico">${LOOP}</span>` : face(b);
    rm.setAttribute("aria-label", t("remove", blockName(b)));
    rm.addEventListener("click", () => removeBlock(path));
    head.appendChild(rm);
    if (b.t === "repeat") {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "count";
      c.textContent = `×${b.n}`;
      c.setAttribute("aria-label", t("cycle", b.n));
      c.addEventListener("click", () => cycleCount(path));
      head.appendChild(c);
    }
    box.appendChild(head);
    const body = document.createElement("div");
    body.className = "body";
    renderList(body, b.body, path, currentHint());
    box.appendChild(body);
    return box;
  }

  // ---------- editing ----------
  function edit(fn) {
    if (runState) return false;
    undoStack.push({ prog: E.clone(prog), cursor: { ...cursor } });
    if (undoStack.length > 60) undoStack.shift();
    fn();
    failPath = null;
    if (resetTimer) resetWalker();
    renderProgram();
    return true;
  }
  function addBlock(b) {
    if (runState || mode !== "play" || winView) return;
    const h = currentHint();
    const hinted = h && h.type === "add" && sameKind(h.block, b);
    const where = hinted ? { parent: h.parent, index: h.index } : cursor;
    const block = hinted ? h.block : b;
    const r = E.insert(prog, where, block);
    if (r.full) {
      sfx("wrong");
      restart($("#program"), "shake");
      say(t("full"), 2200);
      return;
    }
    edit(() => {
      prog = r.prog;
      cursor = r.cursor;
    });
    blip(block.t === "move" ? { U: 79, R: 76, D: 72, L: 74 }[block.d] : 84);
    restart(elAt(r.path), "pop");
    elAt(r.path)?.scrollIntoView({ block: "nearest" });
    // the buddy peeks the way of the new arrow
    if (block.t === "move") {
      walker.face(block.d);
      walker.squish(0.9);
      walker.faceCameraSoon(700);
    }
    if (hintOn && !E.hint(prog, solution) && !L.tutor) say(t("hintDone"), 2400);
  }
  function removeBlock(path) {
    if (runState) return;
    edit(() => {
      const r = E.remove(prog, path);
      prog = r.prog;
      cursor = r.cursor;
    });
    blip(64, 0.12, "triangle");
  }
  function cycleCount(path) {
    if (runState) return;
    edit(() => {
      prog = E.cycleRepeat(prog, path);
    });
    const n = E.blockAt(prog, path).n;
    blip(70 + n * 2);
    restart($(`#program .box[data-path="${path}"] .count`), "pop");
  }
  function undo() {
    if (runState || !undoStack.length) return;
    const s = undoStack.pop();
    prog = s.prog;
    cursor = s.cursor;
    failPath = null;
    if (resetTimer) resetWalker();
    renderProgram();
    blip(67, 0.1, "triangle");
  }
  function clearAll() {
    if (runState || !prog.length) return;
    edit(() => {
      prog = [];
      cursor = { parent: "", index: 0 };
    });
    blip(60, 0.18, "triangle");
  }

  // ---------- controls ----------
  function renderControls() {
    const running = !!runState;
    const n = E.count(prog);
    const s = n ? E.stars(n, L.optimal) : 0;
    const meter = $("#meter");
    meter.innerHTML = `<span><span aria-hidden="true">🧩</span> ${n}</span><span class="stars" aria-hidden="true">${[
      0, 1, 2,
    ]
      .map((k) => `<span class="${k < s ? "on" : ""}">★</span>`)
      .join("")}</span>`;
    meter.setAttribute("aria-label", t("countAria", n, s));
    $("#btnUndo").disabled = running || !undoStack.length;
    $("#btnClear").disabled = running || !prog.length;
    $("#btnUndo").hidden = running;
    $("#btnClear").hidden = running;
    $("#btnStop").hidden = !running;
    const sp = $("#btnSpeed");
    sp.textContent = speed === "slow" ? "🐢" : "🐇";
    sp.setAttribute(
      "aria-label",
      t("speedAria", t(speed === "slow" ? "speedSlow" : "speedFast")),
    );
    const paused = running && runState.stepMode;
    $("#runIcon").textContent = running && !paused ? "⏸" : "▶";
    $("#btnRun").classList.toggle("going", running && !paused);
    $("#btnRun").setAttribute(
      "aria-label",
      t(running && !paused ? "pause" : "run"),
    );
    $("#btnRun").classList.toggle(
      "hint-pulse",
      hintOn && !running && prog.length > 0 && !E.hint(prog, solution),
    );
    $("#dock").classList.toggle("is-running", running);
    $("#btnHint").classList.toggle("on", hintOn);
    $("#btnHint").classList.toggle("hint-pulse", !hintOn && fails >= 2);
  }
  $("#btnUndo").addEventListener("click", undo);
  $("#btnClear").addEventListener("click", clearAll);
  $("#btnStop").addEventListener("click", () => {
    abortRun();
    resetWalker();
    sfx("tap");
  });
  $("#btnSpeed").addEventListener("click", () => {
    speed = speed === "slow" ? "fast" : "slow";
    KidsStore.save(key("speed"), speed);
    blip(speed === "slow" ? 60 : 84);
    renderControls();
  });
  $("#btnRun").addEventListener("click", () => startRun(false));
  $("#btnStep").addEventListener("click", () => startRun(true));
  $("#btnHint").addEventListener("click", () => {
    if (runState) return;
    hintOn = true;
    sfx("chirp");
    renderProgram();
    const h = currentHint();
    say(h ? t("hintSay") : t("hintDone"), 2600);
    const target =
      h && h.type === "add"
        ? $("#program .ghost")
        : h
          ? $("#program .hint-x, #program .count.hint-pulse")
          : $("#btnRun");
    target?.scrollIntoView({
      block: "nearest",
      behavior: reduced() ? "auto" : "smooth",
    });
  });
  $("#btnBack").addEventListener("click", () => {
    sfx("tap");
    goMap();
  });

  // ---------- running ----------
  function abortRun() {
    if (!runState) return;
    runState.abort = true;
    runState.advance?.();
    runState = null;
    clearNow();
    renderControls();
  }
  function clearNow() {
    document
      .querySelectorAll(
        "#program .now, #program .now-box, #program .pass, #program .nopass",
      )
      .forEach((el) => el.classList.remove("now", "now-box", "pass", "nopass"));
    document.querySelectorAll("#program .box.blk-repeat").forEach((box) => {
      const b = E.blockAt(prog, box.dataset.path);
      const c = box.querySelector(".count");
      if (b && c) c.textContent = `×${b.n}`;
    });
  }

  // ▶ runs (or resumes a paused step run, or pauses a running one). 👣 = one block at a time.
  async function startRun(stepMode) {
    if (mode !== "play" || winView) return;
    await KidsAudio.ensure();
    if (runState) {
      runState.stepMode = stepMode || !runState.stepMode;
      const go = runState.advance;
      runState.advance = null;
      renderControls();
      go?.();
      return;
    }
    const res = E.run(world, prog);
    if (res.reason === "empty") {
      sfx("wrong");
      buddy.shake();
      say(t("fail.empty"), 2400);
      live(t("failAria.empty"));
      document
        .querySelectorAll("#palette .blk")
        .forEach((b) => restart(b, "pop"));
      return;
    }
    hushVoice();
    buddy.hush();
    failPath = null;
    resetWalker(true);
    renderProgram();
    const run = { stepMode, abort: false, advance: null };
    runState = run;
    renderControls();
    live(t("running"));
    await wait(reduced() ? 60 : 250);
    for (let i = 0; i < res.trace.length; i++) {
      if (run.abort) return;
      if (run.stepMode && i > 0) {
        await new Promise((r) => (run.advance = r));
        if (run.abort) return;
      }
      await animateStep(res.trace[i], run);
    }
    if (run.abort) return;
    runState = null;
    clearNow();
    if (res.result === "win") onWin();
    else onFail(res);
    renderControls();
  }

  async function animateStep(step, run) {
    const ms = SPEEDS[speed];
    document
      .querySelectorAll("#program .now")
      .forEach((el) => el.classList.remove("now"));
    const box = $(`#program .box[data-path="${step.path}"]`);
    if (step.kind === "loop") {
      document
        .querySelectorAll("#program .now-box")
        .forEach((el) => el.classList.remove("now-box"));
      box?.classList.add("now-box");
      const c = box?.querySelector(".count");
      if (c) {
        c.textContent = `${step.iter}/${step.n}`;
        restart(c, "pop");
      }
      walker.pulse("#ffb703");
      blip(72 + step.iter * 2, 0.07);
      await wait(stepMs(step, ms));
      return;
    }
    if (step.kind === "check") {
      const head = box?.querySelector(".box-head");
      head?.classList.remove("pass", "nopass");
      head?.classList.add("now", step.pass ? "pass" : "nopass");
      board.flashPad(cell.x, cell.y, step.pass);
      if (step.pass) walker.pulse(PAD_COLORS[E.blockAt(prog, step.path).c]);
      blip(step.pass ? 88 : 60, 0.1, step.pass ? "sine" : "triangle");
      await wait(stepMs(step, ms));
      head?.classList.remove("now");
      return;
    }
    const el = $(`#program .blk[data-path="${step.path}"]`);
    el?.classList.add("now");
    el?.scrollIntoView({ block: "nearest" });
    walker.face(step.d);
    if (step.bump) {
      const [dx, dy] = E.DIRS[step.d];
      const hitMs = stepMs(step, ms);
      setTimeout(
        () => !run.abort && board?.wobble(step.x + dx, step.y + dy, step.d),
        hitMs * 0.3,
      );
      sfx("wrong");
      buddy.setMood("think");
      await walker.bump(step.d, hitMs);
      return;
    }
    blip({ U: 79, R: 76, D: 72, L: 74 }[step.d], 0.08);
    await walker.hop(board.pos(step.x, step.y), ms * 0.85);
    cell = { x: step.x, y: step.y };
    if (run.abort) return;
    await wait(ms * 0.15);
    if (step.gem != null) {
      board.takeGem(step.gem);
      sfx("star");
    }
    if (step.splash) {
      board.splash(step.x, step.y);
      sfx("wrong");
      buddy.setMood("wow", 1800);
      await walker.splash(Math.max(ms, 600));
      await wait(Math.max(ms, 600) * 0.5);
    }
  }

  function onFail(res) {
    fails++;
    failPath = res.failPath;
    buddy.setMood(res.reason === "splash" ? "wow" : "think", 1800);
    buddy.shake();
    const text =
      res.reason === "end"
        ? pick(t("fail.end", treatName(1)))
        : pick(t(`fail.${res.reason}`));
    if (res.reason === "end") sfx("wrong");
    if (res.reason === "gems") {
      sfx("wrong");
      board.missingGems();
    }
    board.showBug(cell.x, cell.y);
    say(text, 3000);
    live(t(`failAria.${res.reason}`));
    if (fails >= 2 && !hintOn) {
      hintOn = true;
      setTimeout(() => {
        if (!runState && mode === "play") say(t("hintSay"), 2600);
      }, 2400);
    }
    renderProgram();
    resetTimer = setTimeout(() => {
      resetTimer = 0;
      if (!runState) resetWalker();
    }, 2200);
  }

  function onWin() {
    const blocks = E.count(prog);
    const s = E.stars(blocks, L.optimal);
    const prev = best[L.id] || 0;
    const firstWin = !prev;
    if (s > prev) {
      best[L.id] = s;
      saveBest();
    }
    walker.face(null);
    buddy.setMood("happy", 1600);
    chomp(4);
    board.eatTreat();
    board.setHintPath(null);
    sfx("fanfare");
    setTimeout(() => showWin(s, blocks, firstWin), reduced() ? 300 : 1100);
  }

  // ---------- win: star podium ----------
  function buildPodium(s) {
    const g = new THREE.Group();
    const goal = board.goalPos();
    g.position.copy(goal);
    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.5, 1, 32),
      Kit.toon("#ffffff", { rim: 0.6, rimColor: "#ffd43b" }),
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.47, 0.04, 8, 40).rotateX(Math.PI / 2),
      Kit.flat("#ffd43b"),
    );
    g.add(ped, ring);
    const stars = [0, 1, 2].map((k) => {
      const st = Kit.star3D(k < s ? "#ffc93c" : "#e5dbff");
      st.position.set((k - 1) * 0.72, 1.75 + (k === 1 ? 0.24 : 0), 0.1);
      st.rotation.z = (1 - k) * 0.25;
      st.scale.setScalar(0.001);
      g.add(st);
      return st;
    });
    board.root.add(g);
    board.root.worldToLocal(g.position);
    const H = 0.34;
    stage.tween({
      ms: reduced() ? 1 : 450,
      ease: "outBack",
      onUpdate: (v) => {
        const hgt = Math.max(0.001, v * H);
        ped.scale.set(1, hgt, 1);
        ped.position.y = hgt / 2;
        ring.position.y = hgt;
        walker.root.position.y = goal.y + hgt;
      },
    });
    stars.forEach((st, k) => {
      stage.tween({
        delay: reduced() ? 0 : 350 + k * 330,
        ms: reduced() ? 1 : 500,
        ease: "outBack",
        onUpdate: (v) =>
          st.scale.setScalar(Math.max(0.001, v * (k === 1 ? 0.8 : 0.64))),
        onDone: () => {
          if (k < s) {
            sfx("star");
            stage.burst(st.getWorldPosition(new THREE.Vector3()), {
              shape: "star",
              count: 10,
              speed: 2.5,
            });
          }
        },
      });
    });
    const unsub = stage.onFrame((dt, time) => {
      if (reduced()) return;
      stars.forEach((st, k) => {
        st.rotation.y = Math.sin(time * 1.6 + k) * 0.5;
        st.position.y =
          1.75 + (k === 1 ? 0.24 : 0) + Math.sin(time * 2 + k) * 0.05;
      });
    });
    return {
      dispose() {
        unsub();
        g.parent?.remove(g);
        ped.geometry.dispose();
        ring.geometry.dispose();
      },
    };
  }

  function showWin(s, blocks, firstWin) {
    if (mode !== "play" || !board) return;
    const win = $("#win");
    win.hidden = false;
    winView = true;
    document.body.classList.add("winning");
    podium = buildPodium(s);
    stage.confetti();
    buddy.setMood("happy", 2400);
    buddy.hush(); // keep the star podium clear: the win line is read aloud instead
    speak(pick(t("win", treatName(1))));
    $("#winStars").setAttribute("aria-label", t("winAria", s, blocks));
    [...$("#winStars").children].forEach((el, k) =>
      el.classList.toggle("on", k < s),
    );
    const line = $("#winLine");
    line.textContent = "";
    const count = document.createElement("span");
    count.className = "c3-wincount";
    count.textContent = `🧩 ${t("winBlocks", blocks)}`;
    line.appendChild(count);
    if (s < 3) {
      const more = document.createElement("span");
      more.className = "c3-winbetter";
      more.textContent = t("winBetter", L.optimal);
      line.appendChild(more);
    }
    live(t("winAria", s, blocks));
    const last = li === LEVELS.length - 1;
    $("#btnNext").hidden = last;
    renderTitle();
    (last ? $("#btnMap") : $("#btnNext")).focus();
    win.dataset.newWorld =
      firstWin && !last && LEVELS[li + 1].world !== L.world ? "1" : "";
    win.dataset.allDone =
      firstWin && LEVELS.every((l) => best[l.id]) ? "1" : "";
    reframe(900);
  }
  function closeWin() {
    const win = $("#win");
    podium?.dispose();
    podium = null;
    if (win.hidden) return;
    win.hidden = true;
    winView = false;
    document.body.classList.remove("winning");
  }
  $("#btnReplay").addEventListener("click", () => {
    closeWin();
    sfx("tap");
    resetWalker(true);
    renderProgram();
    reframe(600);
    $("#btnRun").focus();
  });
  $("#btnMap").addEventListener("click", () => {
    sfx("tap");
    goMap($("#win").dataset.allDone ? t("allDone", buddyName()) : null);
  });
  $("#btnNext").addEventListener("click", async () => {
    sfx("tap");
    if ($("#win").dataset.newWorld) {
      li = Math.min(li + 1, LEVELS.length - 1);
      goMap(t("worldDone"));
      return;
    }
    if (busy) return;
    busy = true;
    await fade(true);
    openLevel(Math.min(li + 1, LEVELS.length - 1));
    await fade(false);
    busy = false;
  });

  // ---------- keyboard ----------
  // Arrows add arrow blocks, Backspace undoes, Enter runs; on the map ←/→ change world.
  const KEYS = {
    ArrowUp: "U",
    ArrowDown: "D",
    ArrowLeft: "L",
    ArrowRight: "R",
  };
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (document.querySelector(".kit-backdrop")) return;
    if (!$("#win").hidden) {
      if (e.key === "Escape") $("#btnReplay").click();
      if (e.key === "Tab") {
        const f = [...$("#win").querySelectorAll("button:not([hidden])")];
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) {
          f.at(-1).focus();
          e.preventDefault();
        } else if (!e.shiftKey && i === f.length - 1) {
          f[0].focus();
          e.preventDefault();
        }
      }
      return;
    }
    if (mode === "map") {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        focusIsland(focusWorld + (e.key === "ArrowLeft" ? -1 : 1), true);
      }
      return;
    }
    const d = KEYS[e.key];
    if (d && L.palette.includes(d)) {
      e.preventDefault();
      addBlock({ t: "move", d });
    } else if (e.key === "Backspace") {
      e.preventDefault();
      undo();
    } else if (
      e.key === "Enter" &&
      (document.activeElement === document.body || !document.activeElement)
    ) {
      e.preventDefault();
      startRun(false);
    }
  });

  // ---------- language & buddy ----------
  function renderAll() {
    KidsI18n.apply(DICT);
    if (mode === "map") renderMap();
    else {
      map.render({
        best,
        isOpen,
        current: nextLevel(E, LEVELS, best),
        standing,
      });
      renderTitle();
      renderProgram();
    }
    buddyTap.refreshLabel();
  }
  KidsI18n.onChange(renderAll);
  Mascots.onBuddyChange((id) => {
    buddyId = id;
    board?.setTreat(id);
    renderAll();
    setTimeout(() => {
      buddy.setMood("hop", 700);
      buddy.sound();
      say(
        pick(
          KidsI18n.pickLang(def().greeting) ||
            t("hello", buddyName(), treatName()),
        ),
        3000,
      );
    }, 60);
  });

  // ---------- start ----------
  focusWorld = LEVELS[standing].world;
  setMode("map");
  renderAll();
  placeOnStone(standing);
  reframe();
  window.__code = {
    stage,
    map,
    walker,
    buddy,
    get mode() {
      return mode;
    },
    get busy() {
      return busy;
    },
    get running() {
      return !!runState;
    },
    get board() {
      return board;
    },
    get state() {
      return {
        li,
        prog: E.toCompact(prog),
        hintOn,
        fails,
        failPath,
        focusWorld,
        standing,
        winView,
      };
    },
    openLevel,
    pickStone,
    toScreen: (v) => stage.toScreen(v),
  };
  // Debug/test hook: ?level=2-3 opens a level directly (like the 2D game).
  const want = new URLSearchParams(location.search).get("level");
  const wi = LEVELS.findIndex((l) => l.id === want);
  if (wi >= 0) {
    standing = wi;
    openLevel(wi);
  } else {
    setTimeout(() => {
      if (mode === "map" && !busy) {
        buddy.setMood("hop", 500);
        say(pick(t("hello", buddyName(), treatName())), 4000);
      }
    }, 700);
  }
}
