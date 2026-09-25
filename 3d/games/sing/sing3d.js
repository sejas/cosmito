// Sing with Pipo 3D: a holographic music highway on a floating concert stage.
// Notes glide towards the sing gate; the kid's voice is a comet that lights up
// on pitch. Scoring, songs and pitch detection are shared with the 2D game
// (games/sing/js/songs.js + pitch.js, loaded as classic scripts).
/* global SONGS, Pitch, KidsI18n, KidsStore, KidsAudio, Mascots */
import * as THREE from "three";
import * as Kit from "../../kit/kit.js";
import {
  timeline,
  createSession,
  fakeSinger,
  totalStars,
  rankOf,
  countdownAt,
  noteName,
  pickerLayout,
} from "./logic.js";
import { createHighway } from "./highway.js";
import { createSet } from "./world.js";
import { createRecord } from "./records.js";
import { createPodium } from "./podium.js";

// ?fake=1 replaces the microphone with a simulated singer (demos and tests).
const FAKE = new URLSearchParams(location.search).has("fake");
const TOTAL_STARS = SONGS.length * 3;

const DICT = {
  en: {
    ...Kit.KIT_DICT.en,
    title: (name) => `Sing with ${name}`,
    pickSong: "Pick a song!",
    again: "Sing again",
    songs: "Songs",
    back: "⬅️",
    backLabel: "Back to the songs",
    progressLabel: "Song progress",
    speed: { slow: "🐢 Slow", normal: "🐇 Normal" },
    guide: { on: (name) => `🔊 ${name} sings too`, off: "🔇 I sing alone" },
    names: { sol: "🎼 Do Re Mi", abc: "🎼 C D E" },
    levels: ["", "Easy", "Medium", "Tricky"],
    songLabel: (title, level, stars) =>
      `${title}. ${level}. ${stars} of 3 stars. Tap to sing`,
    buddyLabel: (name) => `${name}, your singing buddy. Tap to say hi`,
    hello: (name) => [
      `Hi! I'm ${name}! Let's sing together! 🎶`,
      "Pick a song and sing with me!",
      "Sing the colored notes. I'll help you! 💛",
      "Ready to sing? 🎤",
    ],
    poke: ["Hee hee, that tickles! 😆", "La la laaa! 🎶", "Let's sing! 🎤"],
    ready: "Get ready! 👂",
    go: "Sing! 🎤",
    higher: "A bit higher! ⬆️",
    lower: "A bit lower! ⬇️",
    singWithMe: "Sing with me! 🎤",
    praise: [
      "Great! 🌟",
      "Wow! 🎉",
      "Super! ✨",
      "Yes!! 💛",
      "Amazing! 🤩",
      "You're on fire! 🔥",
    ],
    micDenied: "I can't hear you! Please allow the microphone 🎤",
    micNone: "I can't find a microphone 😢",
    results: [
      "I couldn't hear you… try again? 🎤",
      "Good try! Let's sing again! 💪",
      "Nice singing! 🎶",
      "SUPERSTAR!! 🤩",
    ],
    resultLine: (hit, total) => `You matched ${hit} of ${total} notes!`,
    resultStars: (n) => `${n} of 3 stars`,
    ranks: [
      "First Note 🎵",
      "New Voice 🎤",
      "Melody Maker 🎶",
      "Songbird 🐦",
      "Superstar 🌟",
    ],
    nextRank: (n, title) => `${n} more ⭐ to become ${title}`,
    maxRank: "You got every star! 🏆",
  },
  es: {
    ...Kit.KIT_DICT.es,
    title: (name) => `Canta con ${name}`,
    pickSong: "¡Elige una canción!",
    again: "Otra vez",
    songs: "Canciones",
    back: "⬅️",
    backLabel: "Volver a las canciones",
    progressLabel: "Progreso de la canción",
    speed: { slow: "🐢 Despacio", normal: "🐇 Normal" },
    guide: {
      on: (name) => `🔊 ${name} canta también`,
      off: "🔇 Canto yo solo",
    },
    names: { sol: "🎼 Do Re Mi", abc: "🎼 C D E" },
    levels: ["", "Fácil", "Media", "Difícil"],
    songLabel: (title, level, stars) =>
      `${title}. ${level}. ${stars} de 3 estrellas. Toca para cantar`,
    buddyLabel: (name) => `${name}, tu amigo cantante. Tócalo para saludar`,
    hello: (name) => [
      `¡Hola! ¡Soy ${name}! ¡Vamos a cantar! 🎶`,
      "¡Elige una canción y canta conmigo!",
      "Canta las notas de colores. ¡Yo te ayudo! 💛",
      "¿Listos para cantar? 🎤",
    ],
    poke: [
      "¡Jiji, me haces cosquillas! 😆",
      "¡La la laaa! 🎶",
      "¡A cantar! 🎤",
    ],
    ready: "¡Prepárate! 👂",
    go: "¡Canta! 🎤",
    higher: "¡Un poco más alto! ⬆️",
    lower: "¡Un poco más bajo! ⬇️",
    singWithMe: "¡Canta conmigo! 🎤",
    praise: [
      "¡Genial! 🌟",
      "¡Guau! 🎉",
      "¡Súper! ✨",
      "¡Sí!! 💛",
      "¡Increíble! 🤩",
      "¡Estás que ardes! 🔥",
    ],
    micDenied: "¡No te oigo! Permite el micrófono 🎤",
    micNone: "No encuentro ningún micrófono 😢",
    results: [
      "No te he oído… ¿otra vez? 🎤",
      "¡Buen intento! ¡Cantemos otra vez! 💪",
      "¡Qué bien cantas! 🎶",
      "¡¡SUPERESTRELLA!! 🤩",
    ],
    resultLine: (hit, total) => `¡Acertaste ${hit} de ${total} notas!`,
    resultStars: (n) => `${n} de 3 estrellas`,
    ranks: [
      "Primera nota 🎵",
      "Voz nueva 🎤",
      "Melodías mágicas 🎶",
      "Pájaro cantor 🐦",
      "Superestrella 🌟",
    ],
    nextRank: (n, title) => `${n} ⭐ más para ser ${title}`,
    maxRank: "¡Tienes todas las estrellas! 🏆",
  },
};
const t = KidsI18n.translator(DICT);
const $ = (s) => document.querySelector(s);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Sing-specific settings and best stars: same keys as the 2D game.
const settings = Object.assign(
  { speed: "normal", guide: "on", names: "sol" },
  KidsStore.load("sing.settings", {}),
);
const best = KidsStore.load("sing.best", {});
const reportProgress = () =>
  KidsStore.setProgress("sing", totalStars(best, SONGS), TOTAL_STARS);

// Chips work even without WebGL.
Kit.ui.buddyChip($("#btnBuddy"), "pipo");
Kit.ui.langChip($("#btnLang"));
Kit.ui.soundChip($("#btnSound"));

const stage = Kit.createStage({
  fallback: "../../../games/sing/",
  sky: { top: "#7aa8ff", middle: "#d6ccff", bottom: "#ffd9ec" },
  fov: 40,
  parallax: 0.35,
});

const bar = Kit.ui.bar(0, TOTAL_STARS);
$("#rankBarHost").appendChild(bar);

let mode = "pick";
const setMode = (m) => {
  mode = m;
  document.body.dataset.mode = m;
};

// ---------- audio + mic ----------
let actx = null;
let analyser = null;
let micStream = null;
let timeBuf = null;
let scheduled = [];

async function ensureAudio() {
  try {
    actx = await KidsAudio.ensure();
  } catch {
    actx = KidsAudio.ctx();
  }
}

async function ensureMic() {
  if (FAKE) return "ok";
  if (analyser) return "ok";
  if (!navigator.mediaDevices?.getUserMedia || !actx) return "none";
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true,
      },
    });
  } catch (e) {
    return e.name === "NotFoundError" ? "none" : "denied";
  }
  const src = actx.createMediaStreamSource(micStream);
  analyser = actx.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(analyser);
  timeBuf = new Float32Array(analyser.fftSize);
  return "ok";
}

function releaseMic() {
  micStream?.getTracks().forEach((tr) => tr.stop());
  micStream = null;
  analyser = null;
}

// Guide melody and countdown notes are tracked so leaving a song silences them.
function tone(midi, when, dur, vol, type) {
  const osc = KidsAudio.tone(midi, when, dur, vol, type);
  if (!osc) return;
  scheduled.push(osc);
  osc.onended = () => (scheduled = scheduled.filter((o) => o !== osc));
}
function stopScheduled() {
  scheduled.forEach((o) => {
    try {
      o.stop();
    } catch {}
  });
  scheduled = [];
}

// ---------- texts ----------
const buddyName = () =>
  KidsI18n.pickLang(Mascots.get(Mascots.buddy("pipo")).name);
const buddyEmoji = () => Mascots.get(Mascots.buddy("pipo")).emoji || "🐤";

const labels = SONGS.map((song) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "song-label kit-glass";
  b.style.setProperty("--c", song.color);
  b.innerHTML = `<span class="sl-title"></span><span class="sl-level"></span>`;
  $("#songList").appendChild(b);
  return b;
});

function renderPick() {
  KidsI18n.apply(DICT);
  const name = buddyName();
  document.title = `${t("title", name)} 3D`;
  $("#gameTitle").textContent = `🎤 ${t("title", name)}`;
  $("#btnSpeed").textContent = t(`speed.${settings.speed}`);
  $("#btnGuide").textContent =
    settings.guide === "on" ? t("guide.on", name) : t("guide.off");
  $("#btnNames").textContent = t(`names.${settings.names}`);
  const have = totalStars(best, SONGS);
  const r = rankOf(have);
  const ranks = t("ranks");
  $("#rankTitle").textContent = ranks[r.rank];
  $("#starCount").textContent = `⭐ ${have} / ${TOTAL_STARS}`;
  bar.set(have, TOTAL_STARS);
  $("#rankNext").textContent = r.last
    ? t("maxRank")
    : t("nextRank", r.toNext, ranks[r.rank + 1]);
  SONGS.forEach((song, i) => {
    const b = labels[i];
    const stars = best[song.id] || 0;
    const title = KidsI18n.pickLang(song.title);
    const level = t("levels")[song.level];
    b.querySelector(".sl-title").textContent = title;
    b.querySelector(".sl-level").textContent =
      `${"🎵".repeat(song.level)} ${level}`;
    b.setAttribute("aria-label", t("songLabel", title, level, stars));
    records[i]?.setStars(stars);
  });
  $("#progressBuddy").textContent = buddyEmoji();
}

function toggle(key, a, b) {
  settings[key] = settings[key] === a ? b : a;
  KidsStore.save("sing.settings", settings);
  KidsAudio.sfx("tap");
  renderPick();
  if (key === "names") highway?.setNames(settings.names);
}
$("#btnSpeed").addEventListener("click", () =>
  toggle("speed", "normal", "slow"),
);
$("#btnGuide").addEventListener("click", () => toggle("guide", "on", "off"));
$("#btnNames").addEventListener("click", () => toggle("names", "sol", "abc"));

// ---------- the 3D world ----------
let set = null;
let highway = null;
let podium = null;
let buddy = null;
let buddyTap = null;
const records = [];
let layout = null;
const spot = new THREE.Vector3(); // where the buddy stands now

function hudInsets() {
  const vis = (el) => el && getComputedStyle(el).display !== "none";
  const top =
    mode === "play"
      ? $("#playHud").getBoundingClientRect().height
      : $(".sing-hud").getBoundingClientRect().height;
  const bottomEl =
    mode === "pick"
      ? $("#pickPanel")
      : mode === "play"
        ? $("#lyrics")
        : $("#resultsPanel");
  const bottom = vis(bottomEl)
    ? bottomEl.getBoundingClientRect().height + 12
    : 0;
  return { top: top + 8, bottom };
}

// Frame a view in the free space between the top and bottom HUD.
function frameView(view, ms = 0) {
  if (!stage) return;
  const { height: h, aspect } = stage.size;
  const { top, bottom } = hudInsets();
  const free = Math.max(0.35, (h - top - bottom) / h);
  const f = Kit.frame({
    margin: 1.06,
    ...view,
    height: view.height / free,
    fov: stage.camera.fov,
    aspect,
  });
  const visible = 2 * f.distance * Math.tan((stage.camera.fov * Math.PI) / 360);
  const up = ((top - bottom) / 2 / h) * visible;
  f.position[1] += up;
  f.target[1] += up;
  return stage.setView(f, ms);
}

// Views and buddy spots per mode and screen shape.
function playLayout(aspect) {
  // a three-quarter view: the gate on the left, the highway sweeping away to the right
  if (aspect >= 1.1)
    return {
      buddy: [-2.4, 0.9],
      buddyScale: 0.9,
      view: { center: [-0.6, 2.4, -2.4], width: 8.6, height: 5.3, elevation: 20, azimuth: 40 },
    };
  return {
    buddy: [2.0, -0.9],
    buddyScale: 0.62,
    view: { center: [-0.1, 2.25, -1.5], width: 5.2, height: 5.8, elevation: 18, azimuth: 26 },
  };
}
function resultsLayout(aspect) {
  if (aspect >= 1.1)
    return {
      buddy: [-2.3, 0.4],
      buddyScale: 0.95,
      podium: [1.0, -0.7],
      view: { center: [-0.45, 1.5, -0.2], width: 7.2, height: 3.9, elevation: 12 },
    };
  return {
    buddy: [-1.45, 1.6],
    buddyScale: 0.7,
    podium: [0.6, -0.9],
    podiumScale: 0.8,
    view: { center: [-0.1, 1.45, 0.2], width: 5.6, height: 4.4, elevation: 11 },
  };
}

// The buddy hops to a new spot (pad and mic follow).
let walk = null;
function buddyTo(x, z, ms = 700, scale = 1) {
  const from = spot.clone();
  const s0 = buddy.object.scale.x;
  walk?.cancel();
  if (!ms || stage.reducedMotion) {
    spot.set(x, 0, z);
    buddy.object.scale.setScalar(scale);
    placeBuddy(0);
    return;
  }
  walk = stage.tween({
    ms,
    ease: "inOutQuad",
    onUpdate: (k) => {
      spot.lerpVectors(from, new THREE.Vector3(x, 0, z), k);
      buddy.object.scale.setScalar(s0 + (scale - s0) * k);
      placeBuddy(Math.sin(k * Math.PI) * 0.8);
    },
    onDone: () => buddyTap?.setBase(),
  });
}
function placeBuddy(lift = 0) {
  const s = buddy.object.scale.x;
  set.pad.position.set(spot.x, 0, spot.z);
  set.pad.scale.setScalar(s);
  buddy.object.position.set(spot.x, 0.25 * s + lift, spot.z);
  const side = spot.x > 0.5 ? -1 : 1; // the mic stands on the gate's side
  set.mic.position.set(spot.x + side * 0.95 * s, 0, spot.z + 0.45 * s);
  set.mic.scale.setScalar(s);
  set.aimAt(spot.x, 1, spot.z);
  buddyTap?.setBase();
}

// Show/hide a group with a springy scale.
function showGroup(g, on, ms = 450) {
  const from = g.scale.x;
  const to = on ? g.userData.fit || 1 : 0.001;
  if (on) g.visible = true;
  if (stage.reducedMotion) {
    g.scale.setScalar(to);
    g.visible = on;
    return;
  }
  stage.tween({
    ms,
    ease: on ? "outBack" : "inQuad",
    onUpdate: (k) => g.scale.setScalar(from + (to - from) * k),
    onDone: () => (g.visible = on),
  });
}

// ---------- game state ----------
let game = null;
let greetTimer = 0;

function layoutPick(ms = 0) {
  const { aspect } = stage.size;
  layout = pickerLayout(SONGS.length, aspect);
  records.forEach((r, i) => {
    const p = layout.records[i];
    r.root.position.set(p.x, p.y, p.z);
    r.root.rotation.y = -p.x * 0.04;
  });
  pins.forEach((p) => p.setOffset([0, -1.05, 0.2]));
  if (mode === "pick") {
    buddyTo(layout.buddy.x, layout.buddy.z, ms, layout.wide ? 1 : 0.9);
    frameView(layout.view, ms);
  }
}

function goPick() {
  stopSong();
  releaseMic();
  setMode("pick");
  renderPick();
  if (!stage) return;
  showGroup(highway.root, false);
  showGroup(podium.root, false);
  records.forEach((r) => (r.shown = true));
  buddy.setMood("idle");
  buddy.hush();
  buddy.lookAt("pointer");
  layoutPick(900);
  const greet = (i) => {
    if (mode !== "pick") return;
    const hello = t("hello", buddyName());
    buddy.say(i === 0 ? hello[0] : pick(hello), 4200);
    buddy.setMood("hop", 400);
    clearTimeout(greetTimer);
    greetTimer = setTimeout(() => greet(i + 1), 9000);
  };
  clearTimeout(greetTimer);
  greetTimer = setTimeout(() => greet(0), 600);
}

async function startSong(song) {
  if (!stage) return;
  await ensureAudio();
  KidsAudio.sfx("tap");
  stopSong();
  clearTimeout(greetTimer);
  setMode("play");

  const tl = timeline(song, settings.speed);
  const g = {
    song,
    tl,
    sess: null,
    startAt: 0,
    clock: null,
    micOk: true,
    beak: 0,
    phrase: -1,
    countdown: undefined,
    energy: 0,
    lastT: -99,
  };
  game = g;
  $("#playTitle").textContent =
    `${song.emoji} ${KidsI18n.pickLang(song.title)}`;
  $("#score").textContent = "0";
  renderLyrics(0);
  records.forEach((r) => (r.shown = false));
  showGroup(podium.root, false);
  highway.setSong(tl, { names: settings.names });
  highway.clear();
  showGroup(highway.root, true, 600);
  const pl = playLayout(stage.size.aspect);
  buddyTo(pl.buddy[0], pl.buddy[1], 800, pl.buddyScale || 1);
  frameView(pl.view, 900);
  buddy.setMood("idle");
  buddy.lookAt(null);
  buddy.say(t("ready"), 2000);

  const mic = await ensureMic();
  if (game !== g) return; // left while the permission prompt was open
  if (mic !== "ok") {
    g.micOk = false;
    buddy.setMood("sleep");
    buddy.say(mic === "none" ? t("micNone") : t("micDenied"), 0);
  }
  g.sess = createSession(tl, { coach: g.micOk });

  const running = actx && actx.state === "running";
  g.clock = running ? () => actx.currentTime : () => performance.now() / 1000;
  const lead = tl.spb * 3 + 0.9;
  g.startAt = g.clock() + lead;
  if (running) {
    for (let k = 3; k >= 1; k--)
      tone(k === 1 ? 84 : 79, g.startAt - k * tl.spb, 0.12, 0.12, "sine");
    if (settings.guide === "on")
      tl.notes.forEach((n) => tone(n.midi, g.startAt + n.start, n.dur, 0.14));
  }
}

function stopSong() {
  stopScheduled();
  game = null;
  countdown.visible = false;
  set && (set.energy = 0);
}

// ---------- per frame ----------
const lookTarget = new THREE.Vector3();
function frame(dt) {
  const g = game;
  if (!g || !g.sess) return;
  const tt = g.clock() - g.startAt;
  const fdt = Math.min(0.1, Math.max(0, tt - g.lastT));
  g.lastT = tt;

  let midi = null;
  let rms = 0;
  if (FAKE) {
    midi = fakeSinger(g.tl.notes, tt);
    rms = midi == null ? 0 : 0.08;
  } else if (analyser) {
    analyser.getFloatTimeDomainData(timeBuf);
    const res = Pitch.detect(timeBuf, actx.sampleRate);
    rms = res.rms;
    if (res.hz > 0) midi = Pitch.hzToMidi(res.hz);
  }
  const events = g.sess.step(tt, midi);
  const sess = g.sess;

  // the buddy's beak follows the voice volume
  g.beak +=
    ((sess.raw !== null ? Math.min(1, 0.35 + rms * 8) : 0) - g.beak) * 0.35;
  buddy.mouth(g.beak);

  for (const e of events) {
    if (e.type === "good") {
      highway.pop(e.note, true);
      $("#score").textContent = sess.score;
      const pill = $("#scorePill");
      pill.classList.remove("pop");
      void pill.offsetWidth;
      pill.classList.add("pop");
      buddy.setMood("hop", 350);
    } else if (e.type === "miss") {
      highway.pop(e.note, false);
    } else if (e.type === "praise") {
      buddy.say(pick(t("praise")), 1600);
      buddy.setMood("wow", 1400);
      stage.burst(
        buddy.object.position.clone().add(new THREE.Vector3(0, 2.2, 0)),
        {
          shape: "star",
          count: 18,
        },
      );
    } else if (e.type === "hint") {
      buddy.say(t(e.dir), 1800);
      buddy.setMood("think", 1500);
    } else if (e.type === "singWithMe") {
      buddy.say(t("singWithMe"), 2000);
      buddy.setMood("hop", 400);
    }
  }
  if (g.micOk && tt > 0) buddy.setBase(sess.onTime > 0.25 ? "happy" : "idle");
  if (g.micOk && sess.upcoming && tt > -0.5) {
    highway.notePos(sess.upcoming, tt, lookTarget);
    buddy.lookAt(lookTarget);
  }
  g.energy = Kit.damp(g.energy, sess.on ? 1 : 0, 6, dt);
  set.energy = g.energy;

  // countdown 3-2-1-🎤 at the gate
  const cd = countdownAt(tt, g.tl.spb);
  if (cd !== g.countdown) {
    g.countdown = cd;
    showCountdown(cd === null || cd > 3 ? null : cd === 0 ? "🎤" : String(cd));
    if (cd === 0 && g.micOk) buddy.say(t("go"), 1200);
  }

  // progress + lyrics
  const p = Math.min(1, Math.max(0, tt / g.tl.duration));
  $("#progressFill").style.width = `${p * 100}%`;
  $("#progressBuddy").style.left = `${p * 100}%`;
  $("#progress").setAttribute("aria-valuenow", String(Math.round(p * 100)));
  if (sess.upcoming && sess.upcoming.phrase !== g.phrase)
    renderLyrics(sess.upcoming.phrase);
  updateLyrics(sess.active);

  highway.update(tt, sess, fdt || dt);
  if (sess.finished) endSong();
}

// ---------- countdown ----------
const countdown = new THREE.Group();
let cdLabel = null;
let cdRing = null;
let cdSpring = new Kit.Spring(0, { stiffness: 260, damping: 11 });
function showCountdown(text) {
  if (!stage) return;
  if (!text) {
    cdSpring.target = 0;
    return;
  }
  countdown.visible = true;
  // one sprite per value: Kit.label's setText can't change the canvas size (see report)
  for (const [k, sp] of Object.entries(cdLabel)) sp.visible = k === text;
  cdSpring.value = 0.2;
  cdSpring.target = 1;
  cdSpring.kick?.(4);
  cdRing.userData.t = 0;
}

// ---------- lyrics ----------
function lyricOf(n) {
  const tok = n.lyric[KidsI18n.get()] || n.lyric.en;
  return tok ? tok.replace(/_/g, " ") : noteName(n.midi, settings.names);
}
function renderLyrics(phrase) {
  const box = $("#lyrics");
  box.innerHTML = "";
  if (!game) return;
  game.phrase = phrase;
  game.tl.notes
    .filter((n) => n.phrase === phrase)
    .forEach((n) => {
      const s = document.createElement("span");
      const txt = lyricOf(n);
      s.textContent = txt;
      s.className = `syl${txt.endsWith("-") ? "" : " space"}`;
      s.dataset.i = n.i;
      box.appendChild(s);
    });
}
function updateLyrics(active) {
  document.querySelectorAll("#lyrics .syl").forEach((s) => {
    const n = game.tl.notes[s.dataset.i];
    s.classList.toggle("now", active === n);
    s.classList.toggle("done", n.done && !n.good);
    s.classList.toggle("good", n.good);
  });
}

// ---------- results ----------
async function endSong() {
  const g = game;
  const { song, sess } = g;
  stopSong();
  const stars = sess.stars();
  if (stars > (best[song.id] || 0)) {
    best[song.id] = stars;
    KidsStore.save("sing.best", best);
    reportProgress();
  }
  setMode("results");
  KidsI18n.apply(DICT);
  $("#resultLine").textContent = t("resultLine", sess.score, sess.notes.length);
  $("#resultStars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
  $("#resultStars").setAttribute("aria-label", t("resultStars", stars));
  $("#btnAgain").onclick = () => startSong(song);
  renderPick();

  showGroup(highway.root, false);
  highway.clear();
  podium.reset();
  const rl = resultsLayout(stage.size.aspect);
  podium.root.position.set(rl.podium[0], 0, rl.podium[1]);
  podium.root.userData.fit = rl.podiumScale || 1;
  showGroup(podium.root, true, 600);
  buddyTo(rl.buddy[0], rl.buddy[1], 700, rl.buddyScale || 1);
  frameView(rl.view, 1000);
  buddy.lookAt(null);
  buddy.say(t("results")[stars], 0);
  buddy.setMood(stars >= 2 ? "happy" : stars === 1 ? "idle" : "think");

  const token = (endSong.token = {});
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => setTimeout(r, i === 0 ? 700 : 420));
    if (endSong.token !== token || mode !== "results") return;
    const earned = i < stars;
    podium.drop(i, earned).then((at) => {
      if (!earned || mode !== "results") return;
      stage.burst(at, {
        shape: "star",
        count: 14,
        colors: ["#ffd43b", "#fff3bf", "#ffffff"],
      });
      if (actx) tone(79 + i * 4, actx.currentTime, 0.25, 0.14, "sine");
    });
  }
  if (stars >= 2) setTimeout(() => mode === "results" && stage.confetti(), 900);
}

// ---------- build the scene ----------
const pins = [];
if (stage) {
  document.documentElement.classList.add("has-3d");
  set = createSet(stage);
  highway = createHighway(stage);
  highway.root.visible = false;
  highway.root.scale.setScalar(0.001);
  stage.scene.add(highway.root);
  podium = createPodium(stage);
  podium.root.visible = false;
  podium.root.scale.setScalar(0.001);
  stage.scene.add(podium.root);

  // countdown: big number + a shockwave ring, at the gate
  cdLabel = {};
  for (const k of ["3", "2", "1", "🎤"])
    cdLabel[k] = Kit.label(k, { size: 2.1, color: "#ff5c9a", outline: "#ffffff" });
  cdRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.07, 8, 48),
    Kit.flat("#ff8fb8", { opacity: 0.9, unique: true }),
  );
  cdRing.userData.t = 9;
  countdown.add(...Object.values(cdLabel), cdRing);
  countdown.position.set(0, 2.5, 0.6);
  countdown.visible = false;
  highway.root.add(countdown);
  stage.onFrame((dt) => {
    if (!countdown.visible) return;
    const s = cdSpring.step(dt);
    countdown.scale.setScalar(Math.max(0.001, s));
    const rt = (cdRing.userData.t += dt);
    cdRing.scale.setScalar(1 + rt * 2.2);
    cdRing.material.opacity = Math.max(0, 0.9 - rt * 1.6);
    if (cdSpring.target === 0 && s < 0.02) countdown.visible = false;
  });

  SONGS.forEach((song, i) => {
    const r = createRecord(stage, song);
    stage.scene.add(r.root);
    stage.tap(r.root, {
      onTap: () => mode === "pick" && startSong(song),
      onHover: (on) => hoverSong(i, on),
      squish: true,
    });
    records.push(r);
  });
  labels.forEach((b) => stage.overlay.appendChild(b));
  $("#songList").hidden = true;
  records.forEach((r, i) =>
    pins.push(
      stage.pin(labels[i], r.root, { offset: [0, -1.05, 0.2], align: "top" }),
    ),
  );

  buddy = Kit.buddyMascot(stage, "pipo");
  buddy.lookAt("pointer");
  buddyTap = stage.tap(buddy.object, {
    label: () => t("buddyLabel", buddyName()),
    onTap: async () => {
      if (mode === "play") return;
      await ensureAudio();
      buddy.celebrate();
      buddy.say(
        pick([...t("poke"), ...KidsI18n.pickLang(buddy.def.greeting)]),
        2200,
      );
    },
  });
  placeBuddy();

  stage.onFrame(frame);
  stage.onResize(relayout);

  Mascots.onBuddyChange(() => {
    renderPick();
    buddyTap.refreshLabel();
    if (mode === "pick")
      setTimeout(() => {
        buddy.celebrate();
        buddy.say(t("hello", buddyName())[0], 3000);
      }, 50);
  });

  window.__sing = {
    stage,
    buddy: () => buddy,
    highway,
    records,
    get mode() {
      return mode;
    },
    get game() {
      return game;
    },
    start: (id) => startSong(SONGS.find((s) => s.id === id)),
  };
}

function hoverSong(i, on) {
  if (!records[i] || mode !== "pick") return;
  records[i].hover = on;
  if (on) {
    buddy?.lookAt(records[i].center());
    KidsAudio.sfx("tap");
  } else buddy?.lookAt("pointer");
}

labels.forEach((b, i) => {
  b.addEventListener("click", () => {
    if (!stage) location.href = "../../../games/sing/";
    else startSong(SONGS[i]);
  });
  b.addEventListener("pointerenter", () => hoverSong(i, true));
  b.addEventListener("pointerleave", () => hoverSong(i, false));
  b.addEventListener("focus", () => hoverSong(i, true));
  b.addEventListener("blur", () => hoverSong(i, false));
});
$("#btnBack").addEventListener("click", goPick);
$("#btnSongs").addEventListener("click", goPick);
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Escape" &&
    mode !== "pick" &&
    !document.querySelector(".kit-dialog")
  )
    goPick();
});
KidsI18n.onChange(() => {
  renderPick();
  if (mode === "play" && game) renderLyrics(game.phrase);
  if (mode === "pick" && buddy) buddy.say(t("hello", buddyName())[0], 3000);
  if (stage) requestAnimationFrame(() => relayout());
});

// Re-fit everything for the current screen (resize, or the HUD changed height).
function relayout() {
  if (!stage) return;
  const { aspect } = stage.size;
  if (mode === "pick") layoutPick(0);
  else if (mode === "play") {
    const pl = playLayout(aspect);
    buddyTo(pl.buddy[0], pl.buddy[1], 0, pl.buddyScale || 1);
    frameView(pl.view);
  } else {
    const rl = resultsLayout(aspect);
    podium.root.position.set(rl.podium[0], 0, rl.podium[1]);
    podium.root.userData.fit = rl.podiumScale || 1;
    podium.root.scale.setScalar(podium.root.userData.fit);
    buddyTo(rl.buddy[0], rl.buddy[1], 0, rl.buddyScale || 1);
    frameView(rl.view);
  }
}

reportProgress();
goPick();
