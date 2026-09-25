// The 3D hub: a floating island where the buddy lives, one portal per game.
/* global GAMES, KidsI18n, KidsStore, KidsAudio, Mascots */
import * as THREE from "three";
import * as Kit from "../kit/kit.js";
import { createIsland } from "./island.js";
import { createPortal } from "./portal.js";
import { layoutHub, rankFor } from "./logic.js";
import { READY_3D } from "../games/ready.js";

const DICT = {
  en: {
    title: "Pipo & Friends",
    tagline: "3D",
    classic: "Classic 2D",
    classicLabel: "Open the classic 2D games",
    soon: "Soon in 3D",
    ready: "3D ✨",
    stars: (n, max) => `⭐ ${n} / ${max}`,
    gameLabel: (title, stars, ready) =>
      `${title}. ${stars}. ${ready ? "Play in 3D" : "Coming soon in 3D"}`,
    soonTitle: "Coming soon in 3D!",
    soonBody: (title) =>
      `${title} is still being built in 3D. Want to play the classic version now?`,
    playClassic: "▶ Play classic",
    back: "Stay here",
    ranks: [
      "New Explorer 🧭",
      "Curious Cub 🐾",
      "Bright Spark ✨",
      "Super Learner 🚀",
      "Legend 👑",
    ],
    next: (n, rank) => `${n} more ⭐ to become ${rank}`,
    maxed: "You collected every star! 🏆",
    welcome: "Welcome to our island! Tap a portal! ✨",
    buddyLabel: (name) => `${name}, your buddy. Tap to say hi`,
    letsGo: "Let's go! 🚀",
    games: "Games",
  },
  es: {
    title: "Pipo y sus amigos",
    tagline: "3D",
    classic: "Clásico 2D",
    classicLabel: "Abrir los juegos clásicos en 2D",
    soon: "Pronto en 3D",
    ready: "3D ✨",
    stars: (n, max) => `⭐ ${n} / ${max}`,
    gameLabel: (title, stars, ready) =>
      `${title}. ${stars}. ${ready ? "Jugar en 3D" : "Pronto en 3D"}`,
    soonTitle: "¡Pronto en 3D!",
    soonBody: (title) =>
      `${title} todavía se está construyendo en 3D. ¿Quieres jugar a la versión clásica?`,
    playClassic: "▶ Jugar al clásico",
    back: "Quedarme aquí",
    ranks: [
      "Explorador novato 🧭",
      "Cachorro curioso 🐾",
      "Chispa brillante ✨",
      "Súper aprendiz 🚀",
      "Leyenda 👑",
    ],
    next: (n, rank) => `${n} ⭐ más para ser ${rank}`,
    maxed: "¡Tienes todas las estrellas! 🏆",
    welcome: "¡Bienvenido a nuestra isla! ¡Toca un portal! ✨",
    buddyLabel: (name) => `${name}, tu amigo. Tócalo para saludar`,
    letsGo: "¡Vamos! 🚀",
    games: "Juegos",
  },
};
const t = KidsI18n.translator(DICT);
const $ = (s) => document.querySelector(s);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Catalogue texts are strings or functions of (buddy name, treats).
function textOf(field, ...args) {
  const v = KidsI18n.pickLang(field);
  return typeof v === "function" ? v(...args) : v;
}
const titleOf = (game) => {
  const buddy = Mascots.get(Mascots.buddy(game.mascot));
  return textOf(
    game.title,
    KidsI18n.pickLang(buddy.name),
    Mascots.treatName(buddy),
  );
};

// Chips work even without WebGL.
Kit.ui.buddyChip($("#btnBuddy"), "pipo");
Kit.ui.langChip($("#btnLang"));
Kit.ui.soundChip($("#btnSound"));

const stage = Kit.createStage({
  container: $("#world"),
  fallback: "../index.html",
  parallax: 0.6,
  fov: 42,
});

const games = GAMES.map((g) => ({
  ...g,
  ready: false,
  href3d: `games/${g.id}/`,
  href2d: `../${g.href}`,
}));

function renderTrophy() {
  const progress = KidsStore.progress();
  const have = games.reduce(
    (s, g) => s + Math.min(progress[g.id]?.stars || 0, g.maxStars),
    0,
  );
  const max = games.reduce((s, g) => s + g.maxStars, 0);
  const ranks = t("ranks");
  const r = rankFor(have, max, ranks.length);
  $("#rank").textContent = ranks[r.rank];
  $("#starCount").textContent = `⭐ ${have} / ${max}`;
  $("#trophyBar").set(have, max);
  $("#next").textContent = r.last
    ? t("maxed")
    : t("next", r.toNext, ranks[r.rank + 1]);
}
const bar = Kit.ui.bar(0, 1);
bar.id = "trophyBar";
$("#barHost").appendChild(bar);

// Accessible list of games (real links/buttons). In 3D they are pinned
// under their portals; without WebGL they are a plain list.
const labels = games.map((game) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "portal-label kit-glass";
  b.style.setProperty("--c", game.color);
  b.innerHTML = `<span class="pl-title"></span><span class="pl-meta"><span class="pl-stars"></span><span class="kit-badge pl-badge"></span></span>`;
  $("#portalList").appendChild(b);
  return b;
});

function renderLabels() {
  const progress = KidsStore.progress();
  games.forEach((game, i) => {
    const b = labels[i];
    const stars = t("stars", progress[game.id]?.stars || 0, game.maxStars);
    b.querySelector(".pl-title").textContent = `${game.emoji} ${titleOf(game)}`;
    b.querySelector(".pl-stars").textContent = stars;
    const badge = b.querySelector(".pl-badge");
    badge.textContent = game.ready ? t("ready") : t("soon");
    badge.classList.toggle("soon", !game.ready);
    b.setAttribute(
      "aria-label",
      t("gameLabel", titleOf(game), stars, game.ready),
    );
  });
}

function render() {
  KidsI18n.apply(DICT);
  document.title = `${t("title")} 3D`;
  renderLabels();
  renderTrophy();
}

// Games listed in 3d/games/ready.js open in 3D; the rest offer the classic version.
games.forEach((g) => (g.ready = READY_3D.includes(g.id)));

let buddy = null;
let portals = [];
let leaving = false;

async function openGame(i) {
  if (leaving) return;
  const game = games[i];
  await KidsAudio.ensure();
  KidsAudio.sfx("tap");
  if (buddy && portals[i]) {
    buddy.lookAt(portals[i].center());
    buddy.setMood("hop", 500);
  }
  if (game.ready) {
    leaving = true;
    buddy?.say(t("letsGo"), 1500);
    KidsAudio.sfx("level");
    if (stage && portals[i]) {
      const c = portals[i].center();
      stage.burst(c, { shape: "star", count: 30 });
      await stage.setView(
        { position: [c.x, c.y + 0.1, c.z + 1.2], target: [c.x, c.y, c.z - 2] },
        750,
        "inCubic",
      );
    }
    location.href = game.href3d;
    return;
  }
  const choice = await Kit.ui.dialog({
    icon: game.emoji,
    title: t("soonTitle"),
    body: t("soonBody", titleOf(game)),
    actions: [
      { text: t("back") },
      { text: t("playClassic"), href: game.href2d, primary: true },
    ],
  });
  if (choice !== 1) buddy?.lookAt("pointer");
}

labels.forEach((b, i) => {
  b.addEventListener("click", () => openGame(i));
  b.addEventListener("pointerenter", () => hoverGame(i, true));
  b.addEventListener("pointerleave", () => hoverGame(i, false));
  b.addEventListener("focus", () => hoverGame(i, true));
  b.addEventListener("blur", () => hoverGame(i, false));
});

function hoverGame(i, on) {
  if (!portals[i]) return;
  portals[i].hover = on;
  if (on) {
    buddy?.lookAt(portals[i].center());
    KidsAudio.sfx("tap");
  } else buddy?.lookAt("pointer");
}

if (stage) {
  document.documentElement.classList.add("has-3d");
  const both = [
    ...layoutHub(games.length, 1.6).portals,
    ...layoutHub(games.length, 0.5).portals,
  ];
  const island = createIsland(stage, { keepOut: both });
  portals = games.map((game, i) => {
    const p = createPortal(stage, game);
    stage.scene.add(p.root);
    stage.tap(p.root, {
      onTap: () => openGame(i),
      onHover: (on) => hoverGame(i, on),
    });
    return p;
  });
  labels.forEach((b) => stage.overlay.appendChild(b));
  $("#portalList").hidden = true;
  const pins = labels.map((b, i) =>
    stage.pin(b, portals[i].root, { offset: [0, 0.3, 0.95], align: "top" }),
  );

  buddy = Kit.buddyMascot(stage, "pipo", { scale: 1.05 });
  buddy.lookAt("pointer");
  const buddyTap = stage.tap(buddy.object, {
    label: () => t("buddyLabel", KidsI18n.pickLang(buddy.def.name)),
    onTap: () => {
      wake();
      buddy.celebrate();
      buddy.say(pick(KidsI18n.pickLang(buddy.def.greeting)), 2600);
    },
  });

  // Doze off when nobody plays for a while; any touch wakes the buddy up.
  let idleTimer = 0;
  const wake = () => {
    clearTimeout(idleTimer);
    if (buddy.base === "sleep") {
      buddy.setMood("idle");
      buddy.setMood("wow", 900);
    }
    idleTimer = setTimeout(() => buddy.setMood("sleep"), 30000);
  };
  ["pointerdown", "keydown"].forEach((e) =>
    addEventListener(e, wake, { passive: true }),
  );
  wake();

  stage.onResize((w, h, aspect) => {
    const l = layoutHub(games.length, aspect);
    portals.forEach((p, i) => {
      p.root.position.set(l.portals[i].x, 0.3, l.portals[i].z);
      // face the camera side, a little towards the centre
      p.root.rotation.y = Math.atan2(-l.portals[i].x, 12) * 0.9;
    });
    buddy.object.position.set(l.buddy.x, 0.36, l.buddy.z);
    island.userData.pad.position.set(l.buddy.x, 0.3, l.buddy.z);
    island.userData.setPaths(l.portals.map((p) => ({ from: l.buddy, to: p })));
    buddyTap.setBase();
    // leave room for the header and trophy panel
    const hudTop = $(".hub3d-head").getBoundingClientRect().height;
    const hudBottom = $(".trophy3d").getBoundingClientRect().height;
    const free = Math.max(0.4, (h - hudTop - hudBottom - 24) / h);
    const v = l.view;
    const f = Kit.frame({ ...v, height: v.height / free, fov: stage.camera.fov, aspect });
    // shift the view so the content sits centred in the space between the HUDs
    const visible = 2 * f.distance * Math.tan((stage.camera.fov * Math.PI) / 360);
    const up = ((hudTop - hudBottom) / 2 / h) * visible;
    f.position[1] += up;
    f.target[1] += up;
    stage.setView(f);
    // wide: labels under the portals; tall: above the rings, so rows don't cover each other
    pins.forEach((p) => {
      p.setOffset(l.wide ? [0, 0.3, 0.95] : [0, 2.75, 0]);
      p.setAlign(l.wide ? "top" : "bottom");
    });
  });

  window.__hub = { stage, buddy: () => buddy, portals, games }; // for e2e tests
  setTimeout(() => {
    buddy.setMood("hop", 450);
    buddy.say(t("welcome"), 3600);
    buddy.sound();
  }, 900);
  Mascots.onBuddyChange(() => {
    render();
    buddyTap.refreshLabel();
    setTimeout(() => {
      buddy.celebrate();
      buddy.say(pick(KidsI18n.pickLang(buddy.def.greeting)), 2400);
    }, 50);
  });
} else {
  Mascots.onBuddyChange(render);
}

KidsI18n.onChange(() => {
  render();
  stage?.refit(); // texts changed: the HUD may be taller or shorter now
});
render();
games.forEach((g, i) => portals[i]?.setReady(g.ready));
