// UI for "Tell the Time". Logic lives in time.js (ClockLogic), the clock
// widget in clock.js (ClockFace). Playable with any mascot; Bollo is default.
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const t = KidsI18n.translator(CLOCK_I18N);
  const L = ClockLogic;
  const GAME = "clock";
  const DEFAULT_BUDDY = "bollo";
  const MODE_EMOJI = { read: "🕐", set: "✋", digital: "🔢", day: "🌞" };
  const MODE_COLOR = {
    read: "#82c8ff",
    set: "#ff9fb8",
    digital: "#9be58a",
    day: "#ffd84d",
    explore: "#c3a6ff",
  };
  // Example time drawn on each level card.
  const LEVEL_SAMPLE = [
    L.make(3, 0),
    L.make(3, 30),
    L.make(3, 15),
    L.make(3, 25),
    L.make(3, 37),
  ];
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const lang = () => KidsI18n.get();
  const say = (time, t24 = null) => L.say(time, lang(), t24);
  const restart = (el, cls) => {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  };

  // ---------- buddy ----------
  let buddyId = Mascots.buddy(DEFAULT_BUDDY);
  const def = () => Mascots.get(buddyId);
  const buddyName = () => KidsI18n.pickLang(def().name);
  const treatName = (n = 2) => Mascots.treatName(def(), n);
  const treatIcon = () => Mascots.treatOf(def()).icon;

  // ---------- persisted state ----------
  const key = (k) => `${GAME}.${k}`;
  const best = KidsStore.load(key("stars"), {});
  let level = KidsStore.load(key("level"), 0);
  if (!(level >= 0 && level < L.LEVELS.length)) level = 0;
  const starsOf = (mode, li) => Math.min(3, best[L.starKey(mode, li)] || 0);
  const levelStars = (li) => L.MODES.reduce((s, m) => s + starsOf(m, li), 0);
  const report = () =>
    KidsStore.setProgress(GAME, L.totalStars(best), L.MAX_STARS);
  report();

  // ---------- mascots ----------
  const mHome = Mascots.create($("#mascotHome"), $("#bubbleHome"), buddyId);
  const mPlay = Mascots.create($("#mascotPlay"), $("#bubblePlay"), buddyId);
  const mScene = Mascots.create($("#mascotScene"), null, buddyId);
  const mResult = Mascots.create(
    $("#mascotResult"),
    $("#bubbleResult"),
    buddyId,
  );
  const allMascots = [mHome, mPlay, mScene, mResult];
  function poke(m) {
    m.sound();
    m.setMood("happy", 900);
    m.say(pick(t("poke")), 1800);
  }

  // ---------- sound & voice ----------
  document.addEventListener("pointerdown", () => KidsAudio.ensure(), true);
  document.addEventListener("keydown", () => KidsAudio.ensure(), true);
  const sfx = (name) => KidsAudio.sfx(name);

  function speak(text) {
    if (KidsAudio.isMuted() || !("speechSynthesis" in window)) return;
    try {
      const clean = text.replace(/\p{Extended_Pictographic}|️/gu, "").trim();
      if (!clean) return;
      const code = lang() === "es" ? "es-ES" : "en-US";
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = code;
      u.rate = 0.9;
      u.pitch = 1.15;
      const voices = speechSynthesis.getVoices();
      const v =
        voices.find((x) => x.lang === code) ||
        voices.find((x) => x.lang.startsWith(code.slice(0, 2)));
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

  // A soft tick while the hands move (throttled).
  let lastTick = 0;
  function tick() {
    const now = performance.now();
    if (now - lastTick < 55) return;
    lastTick = now;
    const ctx = KidsAudio.ctx();
    if (ctx) KidsAudio.tone(96, ctx.currentTime, 0.05, 0.05, "square");
  }

  // ---------- screens ----------
  let current = "home";
  function show(id) {
    hushVoice();
    document
      .querySelectorAll(".screen")
      .forEach((s) => s.classList.toggle("active", s.id === id));
    current = id;
    window.scrollTo(0, 0);
  }

  // ---------- the big clock ----------
  const face = ClockFace.create($("#clockHolder"), {
    label: (time) => say(time),
    shows: (p) => t("clockShows", p),
    secretLabel: () => t("clockAria"),
    names: () => ({ h: t("hourHand"), m: t("minuteHand") }),
  });

  // ---------- HOME ----------
  function starsHTML(s) {
    return [1, 2, 3]
      .map((i) => `<span class="${i <= s ? "on" : ""}">★</span>`)
      .join("");
  }

  function renderHome() {
    const names = t("levels");
    const lv = $("#levels");
    lv.innerHTML = "";
    L.LEVELS.forEach((_, li) => {
      const s = levelStars(li);
      const b = document.createElement("button");
      b.type = "button";
      b.className =
        "level-card" +
        (li === level ? " sel" : "") +
        (s === 12 ? " master" : "");
      b.setAttribute("aria-pressed", li === level);
      b.setAttribute("aria-label", t("levelAria", names[li], s, 12));
      b.appendChild(ClockFace.mini(LEVEL_SAMPLE[li]));
      const n = document.createElement("span");
      n.className = "level-name";
      n.textContent = names[li];
      n.setAttribute("aria-hidden", "true");
      const st = document.createElement("span");
      st.className = "level-stars";
      st.setAttribute("aria-hidden", "true");
      st.textContent = `★ ${s}/12`;
      b.append(n, st);
      if (s === 12)
        b.insertAdjacentHTML(
          "afterbegin",
          '<span class="crown" aria-hidden="true">👑</span>',
        );
      b.addEventListener("click", () => selectLevel(li));
      lv.appendChild(b);
    });

    $("#levelTitle").textContent = t("levelTitle", names[level]);
    const grid = $("#modes");
    grid.innerHTML = "";
    for (const mode of L.MODES) {
      const s = starsOf(mode, level);
      const b = document.createElement("button");
      b.type = "button";
      b.className = `mode mode-${mode}`;
      b.style.setProperty("--mc", MODE_COLOR[mode]);
      b.setAttribute("aria-label", t("modeAria", t(`modes.${mode}`), s));
      const hint = t(`modeHints.${mode}`, buddyName());
      b.innerHTML =
        `<span class="mode-emoji" aria-hidden="true">${MODE_EMOJI[mode]}</span>` +
        `<b aria-hidden="true"></b><small aria-hidden="true"></small>` +
        `<span class="stars" aria-hidden="true">${starsHTML(s)}</span>`;
      b.querySelector("b").textContent = t(`modes.${mode}`);
      b.querySelector("small").textContent = hint;
      b.addEventListener("click", () => startPlay(mode, level));
      grid.appendChild(b);
    }

    const total = L.totalStars(best);
    $("#totalStars").textContent = total;
    $("#maxStars").textContent = L.MAX_STARS;
    $("#totalFill").style.width = `${(total / L.MAX_STARS) * 100}%`;
  }

  function selectLevel(li) {
    sfx("tap");
    level = li;
    KidsStore.save(key("level"), li);
    renderHome();
    const card = $("#levels").children[li];
    card.focus();
    restart(card, "bounce");
    mHome.setMood("hop", 400);
    mHome.say(`${t("levels")[li]} ✨`, 1800);
  }

  let greetTimer = 0;
  function greet() {
    clearTimeout(greetTimer);
    greetTimer = setTimeout(
      () => mHome.say(pick(t("hello", buddyName())), 4000),
      400,
    );
  }
  function goHome() {
    clearTimeout(play.timer);
    renderHome();
    show("home");
    mHome.setMood("idle");
    greet();
  }

  $("#mascotHome").addEventListener("click", () => poke(mHome));
  $("#btnExplore").addEventListener("click", () => startPlay("explore", level));

  const btnSound = $("#btnSound");
  function renderSound() {
    const off = KidsAudio.isMuted();
    btnSound.textContent = off ? t("soundOff") : t("soundOn");
    btnSound.setAttribute("aria-pressed", !off);
  }
  btnSound.addEventListener("click", async () => {
    await KidsAudio.ensure();
    KidsAudio.setMuted(!KidsAudio.isMuted());
    if (KidsAudio.isMuted()) hushVoice();
    renderSound();
    sfx("tap");
  });
  Mascots.mountPicker($("#btnBuddy"), DEFAULT_BUDDY);
  KidsI18n.mountPicker($("#btnLang"));

  // ---------- PLAY ----------
  const play = {
    mode: "read",
    level: 0,
    items: [],
    queue: [],
    q: null,
    locked: false,
    firstTry: 0,
    timer: 0,
    answered: false,
  };

  function startPlay(mode, li) {
    sfx("tap");
    clearTimeout(play.timer);
    Object.assign(play, {
      mode,
      level: li,
      q: null,
      locked: false,
      firstTry: 0,
      answered: false,
    });
    const step = L.LEVELS[li].step;
    document.documentElement.style.setProperty("--mc", MODE_COLOR[mode]);
    $("#play").dataset.mode = mode;
    const day = mode === "day";
    const explore = mode === "explore";
    if (day) {
      play.items = L.dayRound(li).map((s, i) => ({
        ...s,
        dot: i,
        misses: 0,
        state: "",
      }));
    } else if (explore) {
      play.items = [];
    } else {
      play.items = L.round(li).map((time, i) => ({
        t: time,
        dot: i,
        misses: 0,
        state: "",
        kind: mode === "digital" ? (i % 2 ? "d2a" : "a2d") : null,
      }));
    }
    play.queue = play.items.slice();
    face.setStep(explore ? (li === 4 ? 1 : 5) : step);
    face.setMinuteRing(explore || li >= 3);
    face.showGhost(null);
    $("#scene").hidden = !day;
    $("#dots").hidden = explore;
    $("#mascotPlay").hidden = day;
    $("#ctlMinutes").hidden = !explore && step === 60;
    mPlay.setMood("idle");
    mPlay.hush();
    show("play");
    renderPlayTitle();
    if (explore) return startExplore();
    // Day starts an hour before the first scene; quizzes start at 12.
    face.set(day ? play.items[0].t - 60 : 0);
    ask();
  }

  function renderPlayTitle() {
    const lvName = t("levels")[play.level];
    $("#playTitle").textContent =
      play.mode === "explore"
        ? t("exploreTitle")
        : play.mode === "day"
          ? `${t("dayTitle", buddyName())} · ${lvName}`
          : `${MODE_EMOJI[play.mode]} ${t(`modes.${play.mode}`)} · ${lvName}`;
  }

  function renderDots() {
    const el = $("#dots");
    el.innerHTML = "";
    const n = play.items.length;
    const done = play.items.filter(
      (f) => f.state === "good" || f.state === "fixed",
    ).length;
    el.setAttribute("aria-valuemax", n);
    el.setAttribute("aria-valuenow", done);
    el.setAttribute(
      "aria-label",
      play.mode === "day"
        ? t("sceneAria", Math.min(done + 1, n), n)
        : t("progressAria", Math.min(done + 1, n), n),
    );
    for (const f of play.items) {
      const d = document.createElement("span");
      d.className =
        "dot " + f.state + (play.q && play.q.dot === f.dot ? " now" : "");
      if (play.mode === "day") {
        d.classList.add("scene-dot");
        d.textContent = f.emoji;
      } else if (f.state === "good") d.textContent = "★";
      else if (f.state === "fixed") d.textContent = "✓";
      el.appendChild(d);
    }
  }

  // Show/hide the answer widgets for the current question.
  function layout({
    clock = true,
    interactive = false,
    options = false,
    check = false,
    prompt = true,
  }) {
    $("#clockArea").hidden = !clock;
    $("#playMain").classList.toggle("no-clock", !clock);
    $("#prompt").hidden = !prompt;
    face.setInteractive(interactive);
    $("#controls").hidden = !interactive;
    $("#options").hidden = !options;
    $("#btnCheck").hidden = !check;
    $("#btnGotIt").hidden = true;
    $("#readout").hidden = play.mode !== "explore";
    $("#clockCard").classList.remove("good", "oops");
  }

  // Feedback is a function so it can be re-rendered in another language.
  let feedbackFn = null;
  function setFeedback(fn) {
    feedbackFn = fn;
    $("#feedback").textContent = fn ? fn() : "";
  }
  const randomLine = (key) => {
    const i = Math.floor(Math.random() * 100);
    return () => {
      const lines = t(key);
      return lines[i % lines.length];
    };
  };

  function ask() {
    face.showGhost(null);
    setFeedback(null);
    $("#options").innerHTML = "";
    if (!play.queue.length) return finish();
    const q = (play.q = play.queue.shift());
    play.locked = false;
    play.answered = false;
    renderDots();
    const m = play.mode;
    if (m === "read") {
      layout({ options: true });
      face.setSecret(true);
      face.set(q.t, { animate: true, ms: 700 });
      renderPrompt(t("readQ"), "");
      renderOptions(L.choices(q.t, play.level), "words");
    } else if (m === "digital" && q.kind === "a2d") {
      layout({ options: true });
      face.setSecret(true);
      face.set(q.t, { animate: true, ms: 700 });
      renderPrompt(t("digitalA2D"), "");
      renderOptions(L.choices(q.t, play.level), "digital");
    } else if (m === "digital") {
      layout({ clock: false, options: true });
      renderPrompt(t("digitalD2A"), L.digital(q.t), true);
      renderOptions(L.choices(q.t, play.level), "clock");
    } else if (m === "set") {
      layout({ interactive: true, check: true });
      face.setSecret(false);
      if (face.t === q.t) face.set(q.t + 180);
      renderPrompt(t("setQ"), cap(say(q.t)));
      speak(say(q.t));
    } else if (m === "day") {
      layout({ interactive: true, check: true, prompt: false });
      face.setSecret(false);
      if (face.t === q.t) face.set(q.t - 60);
      renderScene();
      updateSky();
      mScene.setMood(q.id === "wake" ? "sleep" : "idle");
      speak(`${sceneLine(q)} ${t("setTo", say(q.t, q.t24))}`);
    }
  }

  function renderPrompt(question, big, lcd = false) {
    $("#promptQ").textContent = question;
    const b = $("#promptBig");
    b.textContent = big;
    b.hidden = !big;
    b.classList.toggle("lcd", lcd);
    if (big) restart(b, "in");
  }

  // kind: "words" (phrases), "digital" (4:45) or "clock" (mini clocks).
  function renderOptions(values, kind) {
    const box = $("#options");
    box.className = `options opt-${kind} n${values.length}`;
    box.innerHTML = "";
    values.forEach((v, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "option";
      b.dataset.value = v;
      if (kind === "clock") {
        b.appendChild(ClockFace.mini(v));
        b.setAttribute("aria-label", `${t("optionClock", i + 1)}: ${say(v)}`);
      } else {
        const s = document.createElement("span");
        s.className = kind === "digital" ? "lcd" : "words";
        s.textContent = kind === "digital" ? L.digital(v) : cap(say(v));
        b.appendChild(s);
      }
      const k = document.createElement("small");
      k.className = "key";
      k.setAttribute("aria-hidden", "true");
      k.textContent = i + 1;
      b.appendChild(k);
      b.addEventListener("click", () => answerOption(b, v));
      box.appendChild(b);
    });
  }

  function sceneLine(q) {
    return t(`scenes.${q.id}`, buddyName(), treatName());
  }

  function renderScene() {
    const q = play.q;
    $("#sceneLine").textContent = sceneLine(q);
    $("#sceneTask").textContent = t("setTo", say(q.t, q.t24));
    const em = $("#sceneEmoji");
    em.replaceChildren();
    if (q.id === "breakfast") {
      em.append("🥣");
      em.appendChild(Mascots.treatEl(def(), "treat"));
    } else em.textContent = q.emoji;
    restart(em, "in");
  }

  function updateSky() {
    if (play.mode !== "day" || !play.q) return;
    const t24 = L.nearest24(face.t, play.q.t24);
    const sky = L.skyAt(t24);
    const box = $("#skyBox");
    box.className = `sky-box phase-${sky.phase}`;
    const orb = $("#orb");
    orb.textContent = sky.sun ? "☀️" : "🌙";
    orb.style.left = `${6 + sky.arc * 80}%`;
    orb.style.top = `${60 - Math.sin(sky.arc * Math.PI) * 48}%`;
  }

  // ---------- answering ----------
  function answerOption(btn, value) {
    if (play.locked || current !== "play") return;
    play.locked = true;
    const q = play.q;
    if (value === q.t) {
      btn.classList.add("right");
      correct(btn);
    } else {
      btn.classList.add("wrong");
      restart(btn, "shake");
      const right = [...$("#options").children].find(
        (b) => Number(b.dataset.value) === q.t,
      );
      right?.classList.add("reveal");
      face.setSecret(false);
      wrong(() => `${t("itsTime", say(q.t))} ${hintFor(q.t)}`);
    }
  }

  function check() {
    if (play.locked || current !== "play" || $("#btnCheck").hidden) return;
    play.locked = true;
    const q = play.q;
    face.setInteractive(false);
    $("#controls").hidden = true;
    $("#btnCheck").hidden = true;
    if (face.t === q.t) return correct($("#clockCard"));
    const mine = face.t;
    face.showGhost(q.t);
    wrong(() => `${t("youSet", say(mine))} ${hintFor(q.t)}`);
    setTimeout(() => {
      if (play.q !== q || current !== "play") return;
      face.set(q.t, { animate: true, ms: 1200 }).then(() => {
        if (play.q === q) {
          face.showGhost(null);
          updateSky();
        }
      });
    }, 700);
  }

  // "The long hand points at 9. The short hand is between 4 and 5."
  function hintFor(time) {
    const h = L.hourOf(time);
    const m = L.minuteOf(time);
    const longAt = m % 5 === 0 ? m / 5 || 12 : null;
    return t("handsHint", longAt, h, (h % 12) + 1, m === 0);
  }

  function correct(fromEl) {
    const q = play.q;
    play.answered = true;
    if (!q.misses) play.firstTry++;
    q.state = q.misses ? "fixed" : "good";
    sfx("correct");
    renderDots();
    const card = $("#clockCard");
    if (!$("#clockArea").hidden) restart(card, "good");
    const phrase = () => (play.mode === "day" ? say(q.t, q.t24) : say(q.t));
    const praise = randomLine("praise");
    setFeedback(() => `${praise()} ${t("itsTime", phrase())}`);
    speak(L.sentence(q.t, lang(), play.mode === "day" ? q.t24 : null));
    KidsFx.burstFrom(fromEl, [treatIcon(), "⭐", "✨"], 12);
    if (play.mode === "day") {
      mScene.sound();
      mScene.setMood(
        q.id === "bed" ? "sleep" : "happy",
        q.id === "bed" ? 0 : 1600,
      );
      updateSky();
      showNext(t("next"));
      return;
    }
    mPlay.sound();
    mPlay.setMood("happy", 1100);
    mPlay.say(pick(t("praise")), 1400);
    play.timer = setTimeout(ask, 1500);
  }

  function wrong(line) {
    const q = play.q;
    q.misses++;
    sfx("wrong");
    $("#clockCard").classList.add("oops");
    const oops = randomLine("oops");
    setFeedback(() => `${oops()} ${line()}`);
    speak(L.sentence(q.t, lang(), play.mode === "day" ? q.t24 : null));
    if (play.mode === "day") {
      mScene.setMood("think", 1600);
      q.state = "retry";
      showNext(t("next"));
    } else {
      mPlay.setMood("think", 1600);
      mPlay.say(t("again"), 2600);
      // Ask it once more at the end of the round.
      if (q.misses === 1) {
        q.state = "retry";
        play.queue.push(q);
      }
      showNext(t("gotIt"));
    }
    renderDots();
  }

  function showNext(label) {
    const b = $("#btnGotIt");
    b.textContent = label;
    b.hidden = false;
    setTimeout(() => b.focus({ preventScroll: true }), 50);
  }

  $("#btnGotIt").addEventListener("click", () => {
    sfx("tap");
    clearTimeout(play.timer);
    ask();
  });
  $("#btnCheck").addEventListener("click", check);
  $("#controls").addEventListener("click", (e) => {
    const b = e.target.closest(".ctl");
    if (!b) return;
    face.nudge(b.dataset.part, Number(b.dataset.dir));
  });

  face.on("change", () => {
    tick();
    updateSky();
    if (play.mode === "explore") renderReadout();
  });
  face.on("grab", () => {
    if (play.mode === "day" && play.q?.id === "wake" && !play.answered)
      mScene.setMood("idle");
  });
  face.on("release", () => {
    if (play.mode === "explore") {
      clearTimeout(play.timer);
      play.timer = setTimeout(() => speak(L.sentence(face.t, lang())), 250);
    }
  });

  // ---------- free play ----------
  function startExplore() {
    layout({ interactive: true, prompt: true });
    face.setSecret(false);
    face.set(L.make(3, 0));
    renderPrompt(t("freeHint"), "");
    renderReadout();
    mPlay.setMood("hop", 500);
    mPlay.say(t("dragHint"), 3000);
  }

  function renderReadout() {
    $("#readDigital").textContent = L.digital(face.t);
    $("#readWords").textContent = cap(say(face.t));
  }

  // ---------- keyboard ----------
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || current !== "play") return;
    if (/^[1-4]$/.test(e.key) && !$("#options").hidden) {
      const btn = $("#options").children[Number(e.key) - 1];
      if (btn) btn.click();
    }
  });

  $("#btnBack").addEventListener("click", () => {
    sfx("tap");
    goHome();
  });
  $("#btnSpeak").addEventListener("click", () => {
    const q = play.q;
    const m = play.mode;
    if (m === "explore") return speak(L.sentence(face.t, lang()));
    if (!q) return;
    if (play.answered || play.locked)
      return speak(L.sentence(q.t, lang(), m === "day" ? q.t24 : null));
    if (m === "read") speak(t("readQ"));
    else if (m === "digital")
      speak(
        q.kind === "a2d" ? t("digitalA2D") : `${t("digitalD2A")} ${say(q.t)}`,
      );
    else if (m === "set") speak(say(q.t));
    else if (m === "day")
      speak(`${sceneLine(q)} ${t("setTo", say(q.t, q.t24))}`);
  });
  $("#mascotPlay").addEventListener("click", () => poke(mPlay));
  $("#mascotScene").addEventListener("click", () => {
    mScene.sound();
    mScene.setMood("hop", 500);
  });

  // ---------- RESULTS ----------
  let last = null;

  function finish() {
    const total = play.items.length;
    const stars = L.starsFor(play.firstTry, total);
    const k = L.starKey(play.mode, play.level);
    const prev = best[k] || 0;
    if (stars > prev) {
      best[k] = stars;
      KidsStore.save(key("stars"), best);
      report();
    }
    last = {
      mode: play.mode,
      level: play.level,
      stars,
      firstTry: play.firstTry,
      total,
      record: stars > prev && prev > 0,
    };
    show("results");
    renderResults(true);
  }

  function renderResults(animate) {
    const r = last;
    if (!r) return;
    const starsEl = $("#bigStars");
    starsEl.setAttribute("aria-label", t("stars", r.stars));
    $("#resultLine").textContent =
      r.mode === "day"
        ? t("resultDay", r.firstTry, r.total)
        : t("result", r.firstTry, r.total);
    $("#resultSub").textContent = r.record ? t("newBest") : "";
    const nextLv = r.stars >= 2 && r.level < L.LEVELS.length - 1;
    const nb = $("#btnNextLevel");
    nb.hidden = !nextLv;
    if (nextLv) nb.textContent = t("nextLevel", t("levels")[r.level + 1]);
    const spans = [...starsEl.children];
    if (animate) {
      spans.forEach((s) => s.classList.remove("on", "dim"));
      spans.forEach((s, i) =>
        setTimeout(
          () => {
            s.classList.add(i < r.stars ? "on" : "dim");
            if (i < r.stars) sfx("star");
          },
          500 + i * 450,
        ),
      );
      setTimeout(
        () => {
          if (current === "results" && r.stars >= 2) {
            sfx("fanfare");
            KidsFx.confetti();
          }
        },
        500 + 3 * 450,
      );
      mResult.setMood(
        r.mode === "day" ? "sleep" : r.stars >= 2 ? "happy" : "hop",
        r.stars >= 2 ? 0 : 500,
      );
    } else {
      spans.forEach((s, i) => s.classList.add(i < r.stars ? "on" : "dim"));
    }
    mResult.say(
      r.mode === "day" ? t("dayDone", buddyName()) : t("results")[r.stars],
      0,
    );
    if (animate) setTimeout(() => $("#btnAgain").focus(), 60);
  }

  $("#btnAgain").addEventListener("click", () =>
    last ? startPlay(last.mode, last.level) : goHome(),
  );
  $("#btnNextLevel").addEventListener("click", () => {
    if (!last) return goHome();
    level = last.level + 1;
    KidsStore.save(key("level"), level);
    startPlay(last.mode, level);
  });
  $("#btnMenu").addEventListener("click", () => {
    sfx("tap");
    goHome();
  });

  // ---------- language & buddy changes ----------
  function renderStatic() {
    KidsI18n.apply(CLOCK_I18N);
    document.title = t("docTitle", buddyName());
    $("#logoName").textContent = buddyName();
    renderSound();
    face.relabel();
    document.querySelectorAll(".ctl").forEach((b) => {
      const what = b.dataset.part === "h" ? t("hours") : t("minutes");
      b.setAttribute(
        "aria-label",
        b.dataset.dir === "1" ? t("plus", what) : t("minus", what),
      );
    });
  }

  function rerender() {
    renderStatic();
    if (current === "home") {
      renderHome();
      greet();
    } else if (current === "play") {
      renderPlayTitle();
      const q = play.q;
      const m = play.mode;
      if (m === "explore") {
        renderPrompt(t("freeHint"), "");
        renderReadout();
      } else if (q) {
        if (m === "read") renderPrompt(t("readQ"), "");
        else if (m === "digital")
          renderPrompt(
            q.kind === "a2d" ? t("digitalA2D") : t("digitalD2A"),
            q.kind === "a2d" ? "" : L.digital(q.t),
            q.kind !== "a2d",
          );
        else if (m === "set") renderPrompt(t("setQ"), cap(say(q.t)));
        else if (m === "day") renderScene();
        // Re-label phrase options in the new language, keeping their state.
        $("#options")
          .querySelectorAll(".option")
          .forEach((b, i) => {
            const v = Number(b.dataset.value);
            const w = b.querySelector(".words");
            if (w) w.textContent = cap(say(v));
            if (b.querySelector("svg"))
              b.setAttribute(
                "aria-label",
                `${t("optionClock", i + 1)}: ${say(v)}`,
              );
          });
        setFeedback(feedbackFn);
        if (!$("#btnGotIt").hidden)
          $("#btnGotIt").textContent = m === "day" ? t("next") : t("gotIt");
        face.setSecret(face.secret);
      }
      renderDots();
    } else if (current === "results") {
      renderResults(false);
    }
  }
  KidsI18n.onChange(rerender);
  Mascots.onBuddyChange((id) => {
    buddyId = id;
    allMascots.forEach((m) => m.use(id));
    rerender();
    const m = {
      home: mHome,
      play: play.mode === "day" ? mScene : mPlay,
      results: mResult,
    }[current];
    m.sound();
    m.setMood("hop", 500);
  });

  // ---------- boot ----------
  renderStatic();
  goHome();
})();
