// Kit demo: every mascot in every mood, treats, particles and glass UI.
// It doubles as the reference for building 3D games; read it next to 3d/README.md.
import * as THREE from "three";
import * as Kit from "./kit.js";

const DICT = {
  en: {
    back: "← 3D island",
    title: "3D kit demo 🧪",
    lead: "Everything the 3D games are built from: mascots, moods, treats, particles and glass UI.",
    moods: "Every buddy, every mood",
    play: "Playground",
    celebrate: "🎉 Celebrate",
    sayHi: "💬 Say hi",
    shake: "🙅 Oops",
    confetti: "🎊 Confetti",
    mouth: "Mouth",
    follow: "Look at my finger",
    glass: "Glass UI",
    panelTitle: "Glass panel",
    panelBody: "Tilt me! Frosted glass floats over the 3D world.",
    progress: "Progress",
    badge: "✨ New in 3D",
    buttons: "Buttons",
    dialog: "Open dialog",
    toast: "Show toast",
    dialogTitle: "Great job!",
    dialogBody: "Dialogs trap focus and close with Escape.",
    again: "Play again",
    toastText: "Toasts say something small.",
    moodNames: {
      idle: "idle",
      happy: "happy",
      wow: "wow",
      think: "think",
      sleep: "sleep",
      hop: "hop",
    },
  },
  es: {
    back: "← Isla 3D",
    title: "Demo del kit 3D 🧪",
    lead: "Todo lo que usan los juegos 3D: mascotas, estados de ánimo, premios, partículas e interfaz de cristal.",
    moods: "Cada amigo, cada estado de ánimo",
    play: "Zona de juego",
    celebrate: "🎉 Celebrar",
    sayHi: "💬 Saludar",
    shake: "🙅 Uy",
    confetti: "🎊 Confeti",
    mouth: "Boca",
    follow: "Mira mi dedo",
    glass: "Interfaz de cristal",
    panelTitle: "Panel de cristal",
    panelBody: "¡Inclíname! El cristal flota sobre el mundo 3D.",
    progress: "Progreso",
    badge: "✨ Nuevo en 3D",
    buttons: "Botones",
    dialog: "Abrir diálogo",
    toast: "Mostrar aviso",
    dialogTitle: "¡Muy bien!",
    dialogBody: "Los diálogos atrapan el foco y se cierran con Escape.",
    again: "Otra vez",
    toastText: "Los avisos dicen algo cortito.",
    moodNames: {
      idle: "tranquilo",
      happy: "feliz",
      wow: "¡guau!",
      think: "pensando",
      sleep: "dormido",
      hop: "salto",
    },
  },
};
const t = KidsI18n.translator(DICT);
const $ = (s) => document.querySelector(s);
const MOODS = ["idle", "happy", "wow", "think", "sleep", "hop"];

// ---------- 1. mood grid ----------
const grid = Kit.createStage({
  container: $("#moods"),
  fallback: "../../shared/mascots/preview.html",
  parallax: 0.3,
});
if (grid) {
  const cells = [];
  for (const id of ["pipo", "bollo"]) {
    for (const mood of MOODS) {
      const m = Kit.mascot(grid, id, { bubble: false });
      m.setMood(mood);
      const tag = document.createElement("span");
      tag.className = "mood-tag";
      grid.pin(tag, m.object, { offset: [0, -0.1, 1.1] });
      cells.push({ m, mood, tag });
    }
  }
  // "hop" is a one-shot: repeat it so the demo shows it.
  setInterval(
    () =>
      cells.filter((c) => c.mood === "hop").forEach((c) => c.m.setMood("hop")),
    1400,
  );
  const renderTags = () =>
    cells.forEach((c) => (c.tag.textContent = t(`moodNames.${c.mood}`)));
  renderTags();
  KidsI18n.onChange(renderTags);
  // each buddy stands on a little holo pad; rows stack vertically like shelves
  for (const c of cells) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(1.05, 32), Kit.holo(c.m.def.color || "#b197fc", { opacity: 0.6, swirl: 0.4 }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.02;
    c.m.object.add(pad);
  }
  grid.onResize((w, h, aspect) => {
    const cols = aspect > 1.25 ? 6 : 3;
    const rows = 12 / cols;
    const dx = 2.7;
    const dy = 3.1;
    cells.forEach((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      c.m.object.position.set((col - (cols - 1) / 2) * dx, -(row - (rows - 1) / 2) * dy, 0);
    });
    grid.fit({ center: [0, 1.1, 0], width: cols * dx, height: rows * dy, elevation: 8, margin: 1.02 });
  });
}

// ---------- 2. playground ----------
const play = Kit.createStage({
  container: $("#play"),
  fallback: "../../shared/mascots/preview.html",
});
let pipo, bollo;
if (play) {
  Kit.createClouds(play.scene, {
    count: 5,
    center: [0, 5, -18],
    area: [40, 5, 8],
  });
  Kit.createSparkles(play.scene, {
    count: 50,
    center: [0, 3, -4],
    area: [18, 7, 8],
  });
  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 5.4, 0.6, 48),
    Kit.toon("#8ce99a"),
  );
  island.position.y = -0.3;
  island.receiveShadow = true;
  play.scene.add(island);
  pipo = Kit.mascot(play, "pipo");
  bollo = Kit.mascot(play, "bollo");
  pipo.object.position.set(-2, 0, 0);
  bollo.object.position.set(2, 0, 0);
  for (const m of [pipo, bollo]) {
    m.lookAt("pointer");
    play.tap(m.object, {
      label: () => KidsI18n.pickLang(m.def.name),
      onTap: () => {
        m.celebrate();
        m.say(KidsI18n.pickLang(m.def.greeting)[0], 2200);
      },
    });
  }
  // treats on floating holo pads
  const treats = [Kit.corn(), Kit.pepper(), Kit.star3D()];
  treats.forEach((tr, i) => {
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 32),
      Kit.holo(["#ffd43b", "#ff6b6b", "#b197fc"][i]),
    );
    pad.rotation.x = -Math.PI / 2;
    const g = new THREE.Group();
    g.add(pad, tr);
    tr.position.y = 0.75;
    g.position.set((i - 1) * 1.3, 0.05, 2.6);
    play.scene.add(g);
    play.tap(g, {
      label: ["corn", "pepper", "star"][i],
      hitRadius: 0.7,
      hitOffset: [0, 0.7, 0],
      onTap: () =>
        play.burst(tr.getWorldPosition(new THREE.Vector3()), {
          shape: i === 2 ? "star" : "confetti",
        }),
    });
    play.onFrame((dt, time) => {
      tr.rotation.y = time * 0.9 + i;
      tr.position.y = 0.75 + Math.sin(time * 2 + i) * 0.08;
    });
  });
  play.onResize((w, h, aspect) =>
    play.fit({ center: [0, 1.1, 0.8], width: 7.2, height: 4.2, elevation: 16 }),
  );

  const btns = $("#moodBtns");
  const renderMoodBtns = () => {
    btns.innerHTML = "";
    for (const mood of MOODS) {
      const b = document.createElement("button");
      b.className = "kit-chip";
      b.type = "button";
      b.textContent = t(`moodNames.${mood}`);
      b.addEventListener("click", () =>
        [pipo, bollo].forEach((m) =>
          m.setMood(mood, mood === "hop" ? 0 : undefined),
        ),
      );
      btns.appendChild(b);
    }
  };
  renderMoodBtns();
  KidsI18n.onChange(renderMoodBtns);
  $("#btnCelebrate").addEventListener("click", async () => {
    await KidsAudio.ensure();
    pipo.celebrate();
    bollo.celebrate();
  });
  $("#btnSay").addEventListener("click", () => {
    pipo.say(KidsI18n.pickLang(pipo.def.greeting)[1], 2400);
    setTimeout(
      () => bollo.say(KidsI18n.pickLang(bollo.def.greeting)[1], 2400),
      600,
    );
  });
  $("#btnShake").addEventListener("click", () => {
    pipo.shake();
    bollo.shake();
    KidsAudio.sfx("wrong");
  });
  $("#btnConfetti").addEventListener("click", () => {
    play.confetti();
    KidsAudio.sfx("fanfare");
  });
  $("#mouth").addEventListener("input", (e) =>
    [pipo, bollo].forEach((m) => m.mouth(+e.target.value)),
  );
  $("#follow").addEventListener("change", (e) =>
    [pipo, bollo].forEach((m) => m.lookAt(e.target.checked ? "pointer" : null)),
  );
}

// ---------- 3. glass UI ----------
Kit.ui.langChip($("#btnLang"));
Kit.ui.buddyChip($("#btnBuddy"), "pipo");
Kit.ui.soundChip($("#btnSound"));
document.querySelectorAll("[data-tilt]").forEach((c) => Kit.ui.tilt(c));
const bar = Kit.ui.bar(7, 10);
$("#barHost").appendChild(bar);
$("#btnDialog").addEventListener("click", () =>
  Kit.ui.dialog({
    icon: "🏆",
    title: t("dialogTitle"),
    body: t("dialogBody"),
    actions: [{ text: Kit.kt("close") }, { text: t("again"), primary: true }],
  }),
);
$("#btnToast").addEventListener("click", () => Kit.ui.toast(t("toastText")));

const render = () => {
  KidsI18n.apply(DICT);
  document.title = t("title");
};
render();
KidsI18n.onChange(render);

// fps readout (the stage that is on screen)
setInterval(() => {
  const s = [grid, play].filter(Boolean).map((st) => st.stats);
  $("#fps").textContent = s.length
    ? `${Math.max(...s.map((x) => x.fps))} fps · q${s[0].level}`
    : "no 3D";
}, 1000);
