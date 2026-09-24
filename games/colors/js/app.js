// UI for Color Lab. Logic lives in palette.js (ColorLab), pictures in
// pictures.js (ColorPictures). Playable with any mascot ("buddy"); Pipo is
// the default. Made for ages 3–7: everything is read aloud, targets are huge,
// and wrong taps only get a gentle hint (the right answer wiggles).
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const t = KidsI18n.translator(COLORS_I18N);
  const C = ColorLab;
  const PIC = ColorPictures;
  const GAME = "colors";
  const DEFAULT_BUDDY = "pipo";
  const INK = PIC.INK;
  const SVGNS = "http://www.w3.org/2000/svg";
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pick = (arr) =>
    Array.isArray(arr) ? arr[Math.floor(Math.random() * arr.length)] : arr;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const restart = (el, cls) => {
    if (!el) return;
    el.classList.remove(cls);
    void el.getBoundingClientRect();
    el.classList.add(cls);
  };
  const cname = (id) => C.nameOf(id, KidsI18n.get());
  const Cap = (s) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

  // ---------- activities & stars ----------
  const SECTIONS = [
    {
      id: "names",
      icon: "🎨",
      color: "#ff6b9a",
      acts: C.QUIZZES.map((q) => ({ id: q.id, icon: q.icon })),
    },
    {
      id: "mix",
      icon: "🧪",
      color: "#6cc4ff",
      acts: [
        { id: "lab", icon: "🧪" },
        ...C.CHALLENGE_SETS.map((s) => ({ id: s.id, icon: s.icon })),
      ],
    },
    {
      id: "paint",
      icon: "🖌️",
      color: "#ffc93c",
      acts: [
        ...PIC.PICTURES.map((p) => ({ id: p.id, icon: p.icon, picture: p })),
        { id: "free", icon: "🖌️", free: true },
      ],
    },
  ];
  const SCORED = SECTIONS.flatMap((s) =>
    s.acts.filter((a) => !a.free).map((a) => a.id),
  );
  const MAX_STARS = SCORED.length * 3;

  // ---------- persisted state ----------
  const key = (k) => `${GAME}.${k}`;
  const best = KidsStore.load(key("best"), {});
  const found = KidsStore.load(key("found"), []);
  const freeArt = KidsStore.load(key("free"), {});
  let showNames = !!KidsStore.load(key("names"), false);
  const starsOf = (id) => Math.min(3, best[id] || 0);
  function saveProgress() {
    KidsStore.save(key("best"), best);
    KidsStore.setProgress(GAME, C.totalStars(best), MAX_STARS);
  }
  function record(id, stars) {
    const better = stars > (best[id] || 0);
    if (better) best[id] = stars;
    saveProgress();
    return better;
  }
  KidsStore.setProgress(GAME, C.totalStars(best), MAX_STARS);

  // ---------- buddy ----------
  let buddyId = Mascots.buddy(DEFAULT_BUDDY);
  const def = () => Mascots.get(buddyId);
  const buddyName = () => KidsI18n.pickLang(def().name);
  const buddyColor = () => C.nearest(def().color || "#ffd23f");

  const mHome = Mascots.create($("#mascotHome"), $("#bubbleHome"), buddyId);
  const mQuiz = Mascots.create($("#mascotQuiz"), $("#bubbleQuiz"), buddyId);
  const mLab = Mascots.create($("#mascotLab"), $("#bubbleLab"), buddyId);
  const mPaint = Mascots.create($("#mascotPaint"), $("#bubblePaint"), buddyId);
  const mWin = Mascots.create($("#mascotWin"), $("#bubbleWin"), buddyId);
  const allMascots = [mHome, mQuiz, mLab, mPaint, mWin];

  // ---------- sound & voice ----------
  document.addEventListener("pointerdown", () => KidsAudio.ensure(), true);
  document.addEventListener("keydown", () => KidsAudio.ensure(), true);
  const sfx = (name) => KidsAudio.sfx(name);
  const blip = (midi, dur = 0.12, type = "sine", vol = 0.1) => {
    const ctx = KidsAudio.ctx();
    if (ctx) KidsAudio.tone(midi, ctx.currentTime, dur, vol, type);
  };
  // A soft "bloop" for pouring and painting, pitched per colour.
  const PITCH = Object.fromEntries(
    C.COLORS.map((c, i) => [
      c.id,
      60 + [0, 4, 7, 9, 12, 14, 16, 2, -5, 19, 5][i],
    ]),
  );
  function bloop(id) {
    const ctx = KidsAudio.ctx();
    if (!ctx) return;
    const m = PITCH[id] ?? 67;
    KidsAudio.tone(m, ctx.currentTime, 0.1, 0.09, "sine");
    KidsAudio.tone(m + 7, ctx.currentTime + 0.07, 0.12, 0.07, "sine");
  }
  const softWrong = () => blip(55, 0.18, "triangle", 0.07);

  // Everything is read aloud for pre-readers. Emoji are not spoken.
  function speak(text) {
    if (KidsAudio.isMuted() || !("speechSynthesis" in window)) return;
    try {
      const clean = text
        .replace(
          /[\p{Extended_Pictographic}\u{FE0F}\u{20E3}\u{1F1E6}-\u{1F1FF}♥★▶↺]/gu,
          "",
        )
        .trim();
      if (!clean) return;
      const lang = KidsI18n.get() === "es" ? "es-ES" : "en-US";
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = lang;
      u.rate = 0.9;
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
  function say(m, text, ms = 3000) {
    m.say(text, ms);
    speak(text);
  }

  // ---------- symbols & pots ----------
  // Every colour has a shape, so no game relies on colour alone.
  const SYMBOLS = {
    heart:
      '<path d="M12 21.2S3 15.6 3 9.4C3 6.3 5.3 4 8 4c1.7 0 3.1.9 4 2.3C12.9 4.9 14.3 4 16 4c2.7 0 5 2.3 5 5.4 0 6.2-9 11.8-9 11.8z"/>',
    star: '<path d="M12 2.2l2.9 6.4 7 .7-5.2 4.7 1.5 6.9L12 17.4l-6.2 3.5 1.5-6.9L2.1 9.3l7-.7z"/>',
    drop: '<path d="M12 2.2c3.6 4.9 7 8.9 7 12.6a7 7 0 0 1-14 0c0-3.7 3.4-7.7 7-12.6z"/>',
    triangle: '<path d="M12 3l10 17.5H2z"/>',
    leaf: '<path d="M20.5 3.5C9 3.5 3.5 9 3.5 15.5c0 1.6.4 3 1 4.2 1.4-4.6 5-8.3 9.5-10.4-4 2.9-6.9 6.9-8 11.2 1.2.6 2.6.9 4 .9 7.3 0 10.5-6.6 10.5-17.9z"/>',
    diamond: '<path d="M12 1.8l9 10.2-9 10.2L3 12z"/>',
    flower:
      '<circle cx="12" cy="6.2" r="4"/><circle cx="17.8" cy="12" r="4"/><circle cx="12" cy="17.8" r="4"/><circle cx="6.2" cy="12" r="4"/><circle cx="12" cy="12" r="3" fill="#fff"/>',
    square: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/>',
    moon: '<path d="M15.5 2.5A9.8 9.8 0 1 0 21.5 18 8.2 8.2 0 0 1 15.5 2.5z"/>',
    cloud:
      '<path d="M7 19.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4-1.6A5.3 5.3 0 0 1 17.5 19.5z"/>',
    ring: '<circle cx="12" cy="12" r="7.2" fill="none" stroke-width="4.2" stroke="currentColor"/>',
  };
  const symbolOf = (id) => SYMBOLS[C.BY_ID[id]?.symbol] || "";
  // An inline symbol for any colour id (mixes use their base's symbol only if named).
  function symbolSvg(id, cls = "sym") {
    return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${symbolOf(id)}</svg>`;
  }

  function jarSvg(hex, id) {
    return `<svg class="jar" viewBox="0 0 64 76" aria-hidden="true">
      <rect x="11" y="3" width="42" height="11" rx="4" fill="#e9edf8" stroke="${INK}" stroke-width="3"/>
      <path class="jar-body" d="M8 16h48v46a11 11 0 0 1-11 11H19A11 11 0 0 1 8 62z" fill="${hex}" stroke="${INK}" stroke-width="3"/>
      <path d="M8 16h48v6c-6 5-10-3-16 2s-10-3-16 1-10-3-16 1z" fill="rgba(255,255,255,0.35)"/>
      <path d="M15 28v26" stroke="#fff" stroke-opacity="0.55" stroke-width="4" stroke-linecap="round"/>
      <circle cx="35" cy="45" r="15" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
      <g transform="translate(24 34) scale(0.92)" fill="${INK}" color="${INK}">${symbolOf(id)}</g>
    </svg>`;
  }

  // A paint-pot button. Names show under pots when the 🔤 toggle is on.
  function potEl(id, cls = "") {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `pot ${cls}`.trim();
    b.dataset.color = id;
    b.style.setProperty("--pc", C.BY_ID[id].hex);
    b.setAttribute("aria-label", Cap(t("pickColor", cname(id))));
    b.innerHTML = `${jarSvg(C.BY_ID[id].hex, id)}<span class="pot-name"></span>`;
    b.querySelector(".pot-name").textContent = cname(id);
    return b;
  }

  // A round splash of colour (bowl results, quiz blob, shelf).
  function blobSvg(hex, cls = "blob") {
    return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 6c14 0 20 9 30 12s16 14 13 28 3 22-8 32-24 14-36 12S21 92 13 80 4 58 8 44 18 16 30 10 44 6 50 6z" fill="${hex}" stroke="${INK}" stroke-width="4"/><ellipse cx="34" cy="30" rx="10" ry="6" fill="#fff" opacity="0.45" transform="rotate(-30 34 30)"/></svg>`;
  }

  // ---------- screens ----------
  let current = "home";
  function show(id) {
    hushVoice();
    current = id;
    document
      .querySelectorAll(".screen")
      .forEach((s) => s.classList.toggle("active", s.id === id));
    window.scrollTo(0, 0);
  }

  // ---------- settings chips ----------
  const soundBtn = $("#btnSound");
  function renderSound() {
    soundBtn.textContent = KidsAudio.isMuted() ? t("soundOff") : t("soundOn");
    soundBtn.setAttribute("aria-pressed", String(!KidsAudio.isMuted()));
  }
  soundBtn.addEventListener("click", async () => {
    KidsAudio.setMuted(!KidsAudio.isMuted());
    if (KidsAudio.isMuted()) hushVoice();
    await KidsAudio.ensure();
    sfx("tap");
    renderSound();
  });
  KidsI18n.mountPicker($("#btnLang"));
  Mascots.mountPicker($("#btnBuddy"), DEFAULT_BUDDY);

  // 🔤 shows every pot's name (for colour-blind players and early readers).
  function renderNamesToggle() {
    document.body.classList.toggle("show-names", showNames);
    document.querySelectorAll(".btn-names").forEach((b) => {
      b.setAttribute("aria-pressed", String(showNames));
      b.setAttribute("aria-label", t(showNames ? "namesOn" : "namesOff"));
      b.classList.toggle("on", showNames);
    });
  }
  document.querySelectorAll(".btn-names").forEach((b) =>
    b.addEventListener("click", () => {
      showNames = !showNames;
      KidsStore.save(key("names"), showNames);
      sfx("tap");
      renderNamesToggle();
    }),
  );
  document
    .querySelectorAll(".btn-back")
    .forEach((b) => b.addEventListener("click", goHome));

  // ---------- home ----------
  function actLabel(a) {
    if (a.picture) return t(`pictures.${a.id}`, buddyName());
    return t(`acts.${a.id}`);
  }
  function starsHtml(s) {
    return [0, 1, 2]
      .map((k) => `<span class="${k < s ? "on" : ""}">★</span>`)
      .join("");
  }

  function renderHome() {
    $("#logoName").textContent = buddyName();
    document.title = t("docTitle", buddyName());
    const total = C.totalStars(best);
    $("#totalStars").textContent = total;
    $("#maxStars").textContent = MAX_STARS;
    $("#totalFill").style.width = `${(100 * total) / MAX_STARS}%`;

    const root = $("#sections");
    root.innerHTML = "";
    for (const sec of SECTIONS) {
      const card = document.createElement("section");
      card.className = "section card";
      card.style.setProperty("--sc", sec.color);
      const scored = sec.acts.filter((a) => !a.free);
      const got = scored.reduce((s, a) => s + starsOf(a.id), 0);
      card.innerHTML = `<div class="section-head"><span class="section-icon" aria-hidden="true"></span><div class="section-text"><h2></h2><p></p></div><span class="section-stars"></span></div><div class="tiles"></div>`;
      card.querySelector(".section-icon").textContent = sec.icon;
      card.querySelector("h2").textContent = t(`sections.${sec.id}`);
      card.querySelector("p").textContent = t(`sectionAbout.${sec.id}`);
      card.querySelector(".section-stars").textContent =
        `${got}/${scored.length * 3} ⭐`;
      const tiles = card.querySelector(".tiles");
      for (const a of sec.acts) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tile";
        b.dataset.act = a.id;
        const label = actLabel(a);
        const s = starsOf(a.id);
        b.setAttribute("aria-label", a.free ? label : t("tileAria", label, s));
        let art;
        if (a.picture)
          art = pictureSvg(a.picture, s ? "done" : "blank", "thumb");
        else if (a.id === "lab")
          art = `<span class="tile-icon lab-icon" aria-hidden="true">${blobSvg(C.BY_ID.green.hex, "mini-blob")}</span>`;
        else
          art = `<span class="tile-icon" aria-hidden="true">${a.icon}</span>`;
        b.innerHTML = `${art}<span class="tile-label" aria-hidden="true"></span>${a.free ? "" : `<span class="stars" aria-hidden="true">${starsHtml(s)}</span>`}`;
        b.querySelector(".tile-label").textContent = label;
        b.addEventListener("click", () => {
          sfx("tap");
          openAct(sec.id, a);
        });
        tiles.appendChild(b);
      }
      root.appendChild(card);
    }
  }

  function openAct(sectionId, a) {
    if (sectionId === "names") openQuiz(a.id);
    else if (sectionId === "mix") openLab(a.id);
    else if (a.free) openPaint(PIC.PICTURES[0].id, "free");
    else openPaint(a.id, "guided");
  }
  // The activity after `id` in its section (for the win dialog's ▶).
  function nextAct(id) {
    for (const sec of SECTIONS) {
      const list = sec.acts.filter((a) => !a.free);
      const i = list.findIndex((a) => a.id === id);
      if (i >= 0) return { sec: sec.id, act: list[(i + 1) % list.length] };
    }
    return null;
  }

  function goHome() {
    sfx("tap");
    closeWin();
    renderHome();
    show("home");
    mHome.setMood("hop", 700);
  }

  $("#mascotHome").addEventListener("click", () => {
    mHome.setMood("happy", 1200);
    mHome.sound();
    say(mHome, pick(t("poke")), 1800);
  });

  // ---------- quiz: colour names ----------
  let Q = null;

  function openQuiz(kind) {
    Q = {
      kind,
      items: C.quizRound(kind),
      i: 0,
      mistakes: 0,
      missed: false,
      locked: false,
    };
    show("quiz");
    $("#quizTitle").textContent = t(`acts.${kind}`);
    mQuiz.setMood("idle");
    mQuiz.hush();
    renderQuestion(true);
  }

  function quizDots() {
    const dots = $("#quizDots");
    dots.innerHTML = Q.items
      .map(
        (_, i) =>
          `<i class="${i < Q.i ? "done" : i === Q.i ? "now" : ""}"></i>`,
      )
      .join("");
    $("#quizDots").parentElement.setAttribute(
      "aria-label",
      t("progress", Q.i + 1, Q.items.length),
    );
  }

  function promptText() {
    const q = Q.items[Q.i];
    if (Q.kind === "find") return t("find", cname(q.answer));
    if (Q.kind === "things") return t("whatThing");
    return t("whatBlob");
  }

  function renderQuestion(fresh) {
    const q = Q.items[Q.i];
    quizDots();
    const p = $("#prompt");
    p.className = `prompt prompt-${Q.kind}`;
    if (Q.kind === "find") {
      p.innerHTML = `<span class="word"></span>`;
      p.querySelector(".word").textContent = Cap(cname(q.answer));
    } else if (Q.kind === "things") {
      p.innerHTML = `<span class="thing" role="img"></span>`;
      p.querySelector(".thing").textContent = q.thing;
      p.querySelector(".thing").setAttribute("aria-label", t("whatThing"));
    } else {
      p.innerHTML = `<span class="blob-wrap">${blobSvg(C.BY_ID[q.answer].hex, "blob big-blob")}${symbolSvg(q.answer, "blob-sym")}</span>`;
    }
    if (fresh) restart(p, "pop-in");

    const opts = $("#options");
    opts.innerHTML = "";
    opts.className = `options options-${Q.kind === "name" ? "words" : "pots"} n${q.options.length}`;
    opts.setAttribute("aria-label", promptText());
    for (const id of q.options) {
      if (Q.kind === "name") {
        const row = document.createElement("div");
        row.className = "word-row";
        const b = document.createElement("button");
        b.type = "button";
        b.className = "word-btn";
        b.dataset.color = id;
        b.textContent = Cap(cname(id));
        b.addEventListener("click", () => answer(id, b));
        const h = document.createElement("button");
        h.type = "button";
        h.className = "round-btn hear";
        h.textContent = "🔊";
        h.setAttribute("aria-label", t("hear", cname(id)));
        h.addEventListener("click", () => {
          sfx("tap");
          speak(Cap(cname(id)));
        });
        row.append(h, b);
        opts.appendChild(row);
      } else {
        const b = potEl(id, "big");
        b.addEventListener("click", () => answer(id, b));
        opts.appendChild(b);
      }
    }
    Q.missed = false;
    Q.locked = false;
    setTimeout(
      () => current === "quiz" && speak(promptText()),
      fresh ? 350 : 150,
    );
  }

  $("#btnListen").addEventListener("click", () => {
    if (!Q) return;
    sfx("tap");
    speak(promptText());
    mQuiz.setMood("hop", 500);
  });

  async function answer(id, el) {
    if (Q.locked) return;
    const q = Q.items[Q.i];
    if (id === q.answer) {
      Q.locked = true;
      sfx("correct");
      restart(el, "yay");
      KidsFx.burstFrom(el, ["⭐", "✨", "🎨"], 10);
      mQuiz.setMood("happy", 1100);
      const text = pick(t("yes", Cap(cname(id))));
      mQuiz.say(text, 1400);
      speak(Cap(cname(id)));
      document
        .querySelectorAll("#options .hint")
        .forEach((h) => h.classList.remove("hint"));
      await wait(1300);
      if (current !== "quiz") return;
      Q.i += 1;
      if (Q.i >= Q.items.length) finishQuiz();
      else renderQuestion(true);
    } else {
      softWrong();
      restart(el, "shake");
      if (!Q.missed) {
        Q.missed = true;
        Q.mistakes += 1;
      }
      mQuiz.setMood("think", 1200);
      const right = document.querySelector(
        `#options [data-color="${q.answer}"]`,
      );
      right?.classList.add("hint");
      const text =
        Q.kind === "find"
          ? t("thatIs", cname(id), cname(q.answer))
          : pick(t("tryAgain"));
      say(mQuiz, text, 2600);
    }
  }

  function finishQuiz() {
    const stars = C.starsFor(Q.mistakes);
    const better = record(Q.kind, stars);
    openWin({ stars, id: Q.kind, better, replay: () => openQuiz(Q.kind) });
  }

  // ---------- lab: mixing ----------
  let L = null;
  const BOWL_BOTTOM = 136;
  const LEVELS = [BOWL_BOTTOM, 118, 98, 80, 62];

  function openLab(mode) {
    L = {
      mode,
      parts: [],
      busy: false,
      mistakes: 0,
      missed: false,
      round: [],
      i: 0,
      hints: [],
    };
    if (mode !== "lab") L.round = C.challengeRound(mode);
    show("lab");
    $("#labTitle").textContent = t(`acts.${mode}`);
    const pots = $("#labPots");
    pots.innerHTML = "";
    for (const id of C.LAB_POTS) pots.appendChild(labPot(id));
    $("#shelf").hidden = mode !== "lab";
    $("#target").hidden = mode === "lab";
    mLab.setMood("idle");
    mLab.hush();
    renderBowl(false);
    if (mode === "lab") {
      renderShelf();
      $("#labDots").innerHTML = "";
      setTimeout(
        () => current === "lab" && say(mLab, t("labIntro"), 3600),
        300,
      );
    } else {
      renderTarget(true);
    }
  }

  function challengeDots() {
    $("#labDots").innerHTML = L.round
      .map(
        (_, i) =>
          `<i class="${i < L.i ? "done" : i === L.i ? "now" : ""}"></i>`,
      )
      .join("");
  }

  function renderTarget(fresh) {
    const c = L.round[L.i];
    challengeDots();
    const box = $("#target");
    box.innerHTML = `<span class="target-blob">${blobSvg(C.hexOf(c.target), "blob")}</span><span class="target-text"></span><button class="round-btn listen" type="button">🔊</button>`;
    box.querySelector(".target-text").textContent = t("make", cname(c.target));
    const lb = box.querySelector(".listen");
    lb.setAttribute("aria-label", t("listen"));
    lb.addEventListener("click", () => {
      sfx("tap");
      speak(t("make", cname(c.target)));
    });
    if (fresh) {
      restart(box, "pop-in");
      setTimeout(
        () => current === "lab" && speak(t("make", cname(c.target))),
        350,
      );
      L.missed = false;
      L.hints = [];
    }
    markHints();
  }

  function markHints() {
    document
      .querySelectorAll("#labPots .pot")
      .forEach((p) =>
        p.classList.toggle("hint", L.hints.includes(p.dataset.color)),
      );
  }

  function renderBowl(animate) {
    const res = C.mix(L.parts);
    const top = LEVELS[Math.min(L.parts.length, C.MAX_PARTS)];
    const liquid = $("#liquid");
    const topEl = $("#liquidTop");
    const hex = res ? res.hex : "#ffffff";
    liquid.setAttribute("y", String(top));
    liquid.style.fill = hex;
    topEl.setAttribute("cy", String(top));
    topEl.setAttribute(
      "rx",
      String(
        res ? Math.sqrt(Math.max(0, 96 * 96 - (top - 40) ** 2)).toFixed(1) : 0,
      ),
    );
    topEl.style.fill = hex;
    $("#swirl").setAttribute("transform", `translate(0 ${top + 12})`);
    $("#swirl").style.display = res ? "" : "none";
    if (animate && res) restart($("#bowl"), "stir");
    const name = $("#bowlName");
    if (res) {
      name.innerHTML = `${symbolSvg(res.id.replace(/^(light|dark)-/, ""), "name-sym")}<span></span>`;
      name.querySelector("span").textContent = Cap(cname(res.id));
      $("#bowl").setAttribute("aria-label", t("bowl", cname(res.id)));
    } else {
      name.innerHTML = "";
      $("#bowl").setAttribute("aria-label", t("bowlEmpty"));
    }
    $("#parts").innerHTML = L.parts
      .map(
        (p) =>
          `<span class="part" style="--pc:${C.BY_ID[p].hex}">${symbolSvg(p, "part-sym")}</span>`,
      )
      .join("");
    $("#btnEmpty").disabled = !L.parts.length;
  }

  // The drop of paint flies from the pot to the bowl.
  async function flyDrop(potEl, hex) {
    if (reduced()) return;
    const from = potEl.getBoundingClientRect();
    const to = $("#bowl").getBoundingClientRect();
    const drop = document.createElement("div");
    drop.className = "drop";
    drop.style.background = hex;
    document.body.appendChild(drop);
    const x0 = from.left + from.width / 2;
    const y0 = from.top + from.height * 0.25;
    const x1 = to.left + to.width / 2;
    const y1 = to.top + to.height * 0.42;
    const mx = (x0 + x1) / 2;
    const my = Math.min(y0, y1) - 80;
    const anim = drop.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(0.6)` },
        { transform: `translate(${mx}px, ${my}px) scale(1.1)`, offset: 0.45 },
        { transform: `translate(${x1}px, ${y1}px) scale(1, 1.3)` },
      ],
      { duration: 520, easing: "cubic-bezier(.4,0,.6,1)" },
    );
    await anim.finished.catch(() => {});
    drop.remove();
  }

  async function pour(id, el) {
    if (L.busy) return;
    if (L.parts.length >= C.MAX_PARTS) {
      softWrong();
      restart($("#btnEmpty"), "hint-pulse");
      say(mLab, t("full"), 2600);
      return;
    }
    L.busy = true;
    restart(el, "pouring");
    bloop(id);
    await flyDrop(el, C.BY_ID[id].hex);
    if (current !== "lab") return;
    L.parts.push(id);
    renderBowl(true);
    const res = C.mix(L.parts);
    blip(72, 0.08, "sine", 0.06);
    if (L.mode === "lab") afterPourLab(res);
    else await afterPourChallenge(res);
    L.busy = false;
  }

  function afterPourLab(res) {
    const isNew = C.DISCOVERIES.includes(res.id) && !found.includes(res.id);
    if (isNew) {
      found.push(res.id);
      KidsStore.save(key("found"), found);
      const stars = C.labStars(found);
      record("lab", stars);
      sfx("level");
      mLab.setMood("wow", 1400);
      say(mLab, t("discovered", cname(res.id)), 3000);
      KidsFx.burstFrom($("#bowl"), ["✨", "🌈", "⭐"], 14);
      renderShelf(res.id);
      if (found.length && C.DISCOVERIES.every((d) => found.includes(d))) {
        setTimeout(() => {
          if (current !== "lab") return;
          KidsFx.confetti();
          openWin({
            stars: 3,
            id: "lab",
            better: false,
            line: t("allFound"),
            replay: () => openLab("lab"),
          });
        }, 1800);
      }
    } else {
      mLab.setMood("hop", 500);
      say(mLab, `${Cap(cname(res.id))}!`, 1600);
    }
  }

  async function afterPourChallenge(res) {
    const c = L.round[L.i];
    if (res.id === c.target) {
      sfx("correct");
      mLab.setMood("happy", 1500);
      say(mLab, t("madeIt", cname(c.target)), 2200);
      KidsFx.burstFrom($("#bowl"), ["⭐", "✨", "🎨"], 14);
      restart($("#target"), "yay");
      await wait(1800);
      if (current !== "lab") return;
      L.parts = [];
      L.i += 1;
      if (L.i >= L.round.length) {
        challengeDots();
        return finishChallenges();
      }
      renderBowl(false);
      renderTarget(true);
    } else if (L.parts.length >= c.recipe.length) {
      softWrong();
      if (!L.missed) {
        L.missed = true;
        L.mistakes += 1;
      }
      mLab.setMood("think", 1500);
      say(mLab, t("notYet", cname(res.id), cname(c.target)), 3000);
      await wait(1600);
      if (current !== "lab") return;
      L.parts = [];
      renderBowl(false);
      L.hints = c.recipe.slice();
      markHints();
    } else {
      mLab.setMood("hop", 500);
      speak(Cap(cname(res.id)));
    }
  }

  function finishChallenges() {
    const stars = C.starsFor(L.mistakes);
    const better = record(L.mode, stars);
    KidsFx.confetti();
    openWin({ stars, id: L.mode, better, replay: () => openLab(L.mode) });
  }

  $("#btnEmpty").addEventListener("click", () => {
    if (!L || L.busy || !L.parts.length) return;
    sfx("tap");
    blip(50, 0.25, "sine", 0.08);
    L.parts = [];
    renderBowl(false);
    restart($("#bowl"), "tip");
  });

  function renderShelf(fresh) {
    const n = C.DISCOVERIES.filter((d) => found.includes(d)).length;
    $("#foundCount").textContent = t("found", n, C.DISCOVERIES.length);
    $("#labDots").innerHTML =
      `<span class="stars">${starsHtml(C.labStars(found))}</span>`;
    const row = $("#shelfRow");
    row.innerHTML = "";
    for (const id of C.DISCOVERIES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "slot";
      if (found.includes(id)) {
        b.classList.add("got");
        b.innerHTML = `${blobSvg(C.hexOf(id), "blob")}<span class="slot-name"></span>`;
        b.querySelector(".slot-name").textContent = cname(id);
        b.setAttribute("aria-label", Cap(cname(id)));
        b.addEventListener("click", () => {
          sfx("tap");
          speak(Cap(cname(id)));
        });
        if (fresh === id) restart(b, "yay");
      } else {
        b.innerHTML = `<span class="mystery" aria-hidden="true">?</span>`;
        b.setAttribute("aria-label", t("secret"));
        b.addEventListener("click", () => hintRecipe(id));
      }
      row.appendChild(b);
    }
  }

  // Tapping a secret colour wiggles its pots, one after the other.
  async function hintRecipe(id) {
    sfx("tap");
    say(mLab, t("hintPots"), 2200);
    const recipe = C.RECIPES[id];
    L.hints = recipe.slice();
    markHints();
    for (const p of recipe) {
      const el = document.querySelector(`#labPots [data-color="${p}"]`);
      restart(el, "nudge");
      bloop(p);
      await wait(450);
    }
    setTimeout(() => {
      if (L && L.mode === "lab") {
        L.hints = [];
        markHints();
      }
    }, 3000);
  }

  // ---------- paint ----------
  let P = null;

  // The whole picture as SVG markup. state: "blank" | "done" (target colours)
  // | a fills map. Used for thumbnails, the canvas and the saved PNG.
  function pictureSvg(pic, state, cls = "", size = 0) {
    const bc = buddyColor();
    const fillOf = (r) => {
      if (state === "done") return C.BY_ID[PIC.targetOf(pic, r, bc)].hex;
      if (state && typeof state === "object" && state[r.id])
        return C.BY_ID[state[r.id]].hex;
      return "#ffffff";
    };
    const dims = size ? ` width="${size}" height="${size}"` : "";
    const regions = pic.regions
      .map(
        (r) =>
          `<path d="${r.d}" fill="${fillOf(r)}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`,
      )
      .join("");
    const lines = pic.lines.map((l) => lineSvg(l)).join("");
    return `<svg xmlns="${SVGNS}" class="${cls}" viewBox="0 0 200 200"${dims} aria-hidden="true">${regions}${lines}</svg>`;
  }
  function lineSvg(l) {
    return l.fill
      ? `<path d="${l.d}" fill="${l.fill}" stroke="${INK}" stroke-width="1.5"/>`
      : `<path d="${l.d}" fill="none" stroke="${INK}" stroke-width="${l.stroke}" stroke-linecap="round"/>`;
  }

  function openPaint(picId, mode) {
    const pic = PIC.PICTURES.find((p) => p.id === picId);
    P = {
      pic,
      mode,
      fills: mode === "free" ? { ...(freeArt[picId] || {}) } : {},
      selected: null,
      mistakes: 0,
      missed: {},
      done: false,
    };
    show("paint");
    renderPaint(true);
    mPaint.setMood("idle");
    mPaint.hush();
    setTimeout(
      () =>
        current === "paint" &&
        say(mPaint, t(mode === "free" ? "freeIntro" : "paintIntro"), 3400),
      300,
    );
  }

  const targetFor = (r) => PIC.targetOf(P.pic, r, buddyColor());

  function renderPaint(fresh) {
    const { pic, mode } = P;
    $("#paintTitle").textContent =
      mode === "free"
        ? `${t("acts.free")} · ${t(`pictures.${pic.id}`, buddyName())}`
        : t(`pictures.${pic.id}`, buddyName());
    $("#paintStars").innerHTML =
      mode === "free" ? "" : starsHtml(starsOf(pic.id));
    $("#btnClear").hidden = mode !== "free";

    // Picture strip (free paint): switch pictures.
    const strip = $("#picStrip");
    strip.hidden = mode !== "free";
    if (mode === "free") {
      strip.innerHTML = "";
      for (const p of PIC.PICTURES) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "pic-btn";
        b.setAttribute("aria-label", t(`pictures.${p.id}`, buddyName()));
        b.setAttribute("aria-pressed", String(p.id === pic.id));
        b.innerHTML = pictureSvg(p, freeArt[p.id] || "blank", "thumb");
        b.addEventListener("click", () => {
          if (p.id === P.pic.id) return;
          sfx("tap");
          const sel = P.selected;
          openPaint(p.id, "free");
          P.selected = sel;
          renderPots();
        });
        strip.appendChild(b);
      }
    }

    // The picture
    const svg = $("#picture");
    svg.innerHTML = "";
    pic.regions.forEach((r, i) => {
      const path = document.createElementNS(SVGNS, "path");
      path.setAttribute("d", r.d);
      path.setAttribute("class", "region");
      path.dataset.id = r.id;
      path.setAttribute("tabindex", "0");
      path.setAttribute("role", "button");
      path.setAttribute("aria-label", t("part", i + 1));
      paintRegion(path, r);
      path.addEventListener("click", () => tapRegion(r, path));
      path.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          tapRegion(r, path);
        }
      });
      svg.appendChild(path);
    });
    const deco = document.createElementNS(SVGNS, "g");
    deco.setAttribute("class", "deco");
    deco.innerHTML = pic.lines.map(lineSvg).join("");
    svg.appendChild(deco);
    const syms = document.createElementNS(SVGNS, "g");
    syms.setAttribute("class", "syms");
    svg.appendChild(syms);
    renderSymbols();
    if (fresh) restart(svg, "pop-in");
    renderPots();
  }

  function paintRegion(path, r) {
    const id = P.fills[r.id];
    path.style.fill = id ? C.BY_ID[id].hex : "#ffffff";
  }

  // Blank regions show their target's symbol (guided mode only).
  function renderSymbols() {
    const g = $("#picture .syms");
    if (!g) return;
    if (P.mode !== "guided") return (g.innerHTML = "");
    g.innerHTML = P.pic.regions
      .filter((r) => !P.fills[r.id])
      .map((r) => {
        const id = targetFor(r);
        return `<g transform="translate(${r.at[0] - 7} ${r.at[1] - 7}) scale(0.5833)" fill="${INK}" color="${INK}" opacity="0.55" data-for="${r.id}">${symbolOf(id)}</g>`;
      })
      .join("");
  }

  function renderPots() {
    const box = $("#paintPots");
    box.innerHTML = "";
    const order = C.COLORS.map((c) => c.id);
    const ids =
      P.mode === "guided" ? PIC.colorsOf(P.pic, buddyColor(), order) : order;
    if (!ids.includes(P.selected)) P.selected = ids[0];
    for (const id of ids) {
      const b = potEl(id);
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(id === P.selected));
      b.classList.toggle("selected", id === P.selected);
      b.addEventListener("click", () => {
        P.selected = id;
        bloop(id);
        speak(Cap(cname(id)));
        box.querySelectorAll(".pot").forEach((p) => {
          const on = p.dataset.color === id;
          p.classList.toggle("selected", on);
          p.setAttribute("aria-checked", String(on));
          if (on) p.classList.remove("hint");
        });
        restart(b, "nudge");
      });
      box.appendChild(b);
    }
  }

  function tapRegion(r, path) {
    if (P.done) return;
    const color = P.selected;
    if (P.mode === "free") {
      P.fills[r.id] = color;
      paintRegion(path, r);
      splash(path);
      bloop(color);
      freeArt[P.pic.id] = { ...P.fills };
      KidsStore.save(key("free"), freeArt);
      const thumb = document.querySelector(
        "#picStrip .pic-btn[aria-pressed='true']",
      );
      if (thumb) thumb.innerHTML = pictureSvg(P.pic, P.fills, "thumb");
      return;
    }
    const want = targetFor(r);
    if (P.fills[r.id] === want) {
      splash(path);
      return;
    }
    if (color === want) {
      P.fills[r.id] = color;
      paintRegion(path, r);
      splash(path);
      bloop(color);
      renderSymbols();
      document
        .querySelectorAll("#paintPots .hint")
        .forEach((h) => h.classList.remove("hint"));
      if (P.pic.regions.every((x) => P.fills[x.id] === targetFor(x)))
        finishPaint();
      else if (Math.random() < 0.25) {
        mPaint.setMood("hop", 500);
      }
    } else {
      softWrong();
      restart(path, "shake-region");
      if (!P.missed[r.id]) {
        P.missed[r.id] = true;
        P.mistakes += 1;
      }
      mPaint.setMood("think", 1200);
      say(mPaint, t("wants", cname(want)), 2600);
      const pot = document.querySelector(`#paintPots [data-color="${want}"]`);
      pot?.classList.add("hint");
    }
  }

  function splash(path) {
    restart(path, "splash");
  }

  async function finishPaint() {
    P.done = true;
    const stars = C.starsFor(P.mistakes);
    const better = record(P.pic.id, stars);
    $("#paintStars").innerHTML = starsHtml(starsOf(P.pic.id));
    mPaint.setMood("happy", 1500);
    sfx("fanfare");
    KidsFx.confetti();
    const id = P.pic.id;
    await wait(1300);
    if (current !== "paint") return;
    openWin({
      stars,
      id,
      better,
      canSave: true,
      replay: () => openPaint(id, "guided"),
    });
  }

  $("#btnClear").addEventListener("click", () => {
    if (!P || P.mode !== "free") return;
    sfx("tap");
    P.fills = {};
    delete freeArt[P.pic.id];
    KidsStore.save(key("free"), freeArt);
    renderPaint(true);
  });

  // Save the painting as a PNG (SVG → canvas → download). Works offline.
  function savePng() {
    if (!P) return;
    const size = 1000;
    const markup = pictureSvg(P.pic, P.fills, "", size);
    try {
      const url = URL.createObjectURL(
        new Blob([markup], { type: "image/svg+xml" }),
      );
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const cx = canvas.getContext("2d");
        cx.fillStyle = "#fff";
        cx.fillRect(0, 0, size, size);
        cx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `color-lab-${P.pic.id}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
          sfx("star");
          const m = $("#win").hidden ? mPaint : mWin;
          say(m, t("saved"), 1800);
        }, "image/png");
      };
      img.src = url;
    } catch {}
  }
  $("#btnSave").addEventListener("click", () => {
    sfx("tap");
    savePng();
  });
  $("#btnWinSave").addEventListener("click", savePng);

  // ---------- win dialog ----------
  let W = null;
  async function openWin(opts) {
    W = opts;
    const win = $("#win");
    win.hidden = false;
    KidsI18n.apply(COLORS_I18N, win);
    $("#winTitle").textContent = pick(t("winTitle"));
    $("#winLine").textContent = opts.line || t("winLine", opts.stars);
    $("#btnWinSave").hidden = !opts.canSave;
    const spans = [...$("#bigStars").children];
    spans.forEach((s) => s.classList.remove("on"));
    $("#bigStars").setAttribute("aria-label", `${opts.stars} / 3 ★`);
    mWin.setMood("happy");
    sfx("fanfare");
    say(mWin, pick(t("winSay", buddyName())), 3500);
    $("#btnNext").focus();
    for (let i = 0; i < opts.stars; i++) {
      await wait(reduced() ? 0 : 320);
      if (win.hidden) return;
      spans[i].classList.add("on");
      sfx("star");
    }
  }
  function closeWin() {
    $("#win").hidden = true;
    mWin.setMood("idle");
  }
  $("#btnReplay").addEventListener("click", () => {
    sfx("tap");
    closeWin();
    W?.replay();
  });
  $("#btnHome").addEventListener("click", goHome);
  $("#btnNext").addEventListener("click", () => {
    sfx("tap");
    closeWin();
    const n = W && nextAct(W.id);
    if (!n) return goHome();
    openAct(n.sec, n.act);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#win").hidden) goHome();
  });

  // ---------- language & buddy ----------
  function renderAll() {
    KidsI18n.apply(COLORS_I18N);
    renderSound();
    renderNamesToggle();
    renderHome();
    if (current === "quiz" && Q) {
      $("#quizTitle").textContent = t(`acts.${Q.kind}`);
      renderQuestion(false);
      Q.locked = false;
    } else if (current === "lab" && L) {
      $("#labTitle").textContent = t(`acts.${L.mode}`);
      renderBowl(false);
      document
        .querySelectorAll("#labPots .pot")
        .forEach((p) => p.replaceWith(labPot(p.dataset.color)));
      markHints();
      if (L.mode === "lab") renderShelf();
      else renderTarget(false);
    } else if (current === "paint" && P) {
      renderPaint(false);
    }
  }
  function labPot(id) {
    const b = potEl(id, "big");
    b.addEventListener("click", () => pour(id, b));
    return b;
  }

  KidsI18n.onChange(renderAll);
  Mascots.onBuddyChange((id) => {
    buddyId = id;
    allMascots.forEach((m) => m.use(id));
    renderHome();
    if (
      current === "paint" &&
      P &&
      P.pic.regions.some((r) => r.target === "buddy")
    ) {
      // The buddy picture takes the new buddy's colour; start it fresh.
      if (P.mode === "guided") openPaint(P.pic.id, "guided");
      else renderPaint(false);
    }
    mHome.setMood("hop", 700);
    mHome.sound();
    say(
      mHome,
      pick(KidsI18n.pickLang(def().greeting) || t("hello", buddyName())),
      3000,
    );
  });

  // ---------- start ----------
  renderAll();
  setTimeout(
    () => current === "home" && say(mHome, pick(t("hello", buddyName())), 4000),
    500,
  );

  // Debug/test hook: ?play=find|things|name|lab|mix1|mix2|house|…|free
  const want = new URLSearchParams(location.search).get("play");
  for (const sec of SECTIONS) {
    const a = sec.acts.find((x) => x.id === want);
    if (a) openAct(sec.id, a);
  }
})();
