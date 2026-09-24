// UI for the times-tables game. Logic lives in questions.js (TTLogic).
// Playable with any mascot ("buddy"); Bollo is the default. The buddy's treat
// is the counting unit and the reward.
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const t = KidsI18n.translator(TT_I18N);
  const L = TTLogic;
  const GAME = "times-tables";
  const DEFAULT_BUDDY = "bollo";
  const RUSH_MS = 60000;
  const BONUS_MS = 3000;
  const MAX_BONUSES = 5; // at most +15 s per rush
  const COLORS = [
    "#ff9fb8", "#ffb570", "#ffd84d", "#9be58a", "#6ee0c0",
    "#82c8ff", "#9fb0ff", "#c3a6ff", "#f7a1d0", "#ff9a8a",
  ];
  // Used only if a mascot file forgot to define a treat.
  const FALLBACK_TREAT = {
    icon: "⭐",
    name: { en: { one: "star", many: "stars" }, es: { one: "estrella", many: "estrellas" } },
  };
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const colorOf = (n) => COLORS[(n - 1) % COLORS.length];
  const restart = (el, cls) => {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  };

  // ---------- buddy & treat ----------
  let buddyId = Mascots.buddy(DEFAULT_BUDDY);
  function def() {
    const d = Mascots.get(buddyId);
    return d.treat ? d : { ...d, treat: FALLBACK_TREAT };
  }
  const buddyName = () => KidsI18n.pickLang(def().name);
  const treatName = (count = 2) => Mascots.treatName(def(), count);
  const treatEl = (cls = "treat") => Mascots.treatEl(def(), cls);
  const treatIcon = () => def().treat.icon;

  // ---------- persisted state ----------
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

  // ---------- mascots ----------
  const mHome = Mascots.create($("#mascotHome"), $("#bubbleHome"), buddyId);
  const mLearn = Mascots.create($("#mascotLearn"), $("#bubbleLearn"), buddyId);
  const mPlay = Mascots.create($("#mascotPlay"), $("#bubblePlay"), buddyId);
  const mResult = Mascots.create($("#mascotResult"), $("#bubbleResult"), buddyId);
  const allMascots = [mHome, mLearn, mPlay, mResult];

  // Munch: open/close the mouth a few times.
  function chomp(m, times = 4) {
    let i = 0;
    const step = () => {
      m.mouth(i % 2 ? 0 : 0.9);
      if (++i < times * 2) setTimeout(step, 110);
      else m.mouth(0);
    };
    step();
  }
  function poke(m) {
    m.sound();
    chomp(m, 2);
    m.setMood("happy", 900);
    m.say(pick(t("poke", cap(treatName()))), 1800);
  }

  // ---------- sound & voice ----------
  document.addEventListener("pointerdown", () => KidsAudio.ensure(), true);
  document.addEventListener("keydown", () => KidsAudio.ensure(), true);
  const sfx = (name) => KidsAudio.sfx(name);

  function speak(text) {
    if (KidsAudio.isMuted() || !("speechSynthesis" in window)) return;
    try {
      const lang = KidsI18n.get() === "es" ? "es-ES" : "en-US";
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = 0.9;
      u.pitch = 1.2;
      const voices = speechSynthesis.getVoices();
      const v = voices.find((x) => x.lang === lang) || voices.find((x) => x.lang.startsWith(lang.slice(0, 2)));
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

  // ---------- screens ----------
  let current = "home";
  function show(id) {
    hushVoice();
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
    current = id;
    window.scrollTo(0, 0);
  }

  // Treat array: `rows` rows of `per` treats, with the skip-count at the end of each row.
  function renderArray(el, per, rows, animateFrom = 0) {
    el.innerHTML = "";
    const step = Math.min(70, 900 / Math.max(1, per * (rows - animateFrom)));
    for (let r = 0; r < rows; r++) {
      const row = document.createElement("div");
      row.className = "t-row" + (r === rows - 1 ? " last" : "");
      for (let c = 0; c < per; c++) {
        const s = treatEl("unit");
        if (r >= animateFrom) {
          s.classList.add("grow");
          s.style.animationDelay = `${((r - animateFrom) * per + c) * step}ms`;
        }
        row.appendChild(s);
      }
      const n = document.createElement("span");
      n.className = "t-count";
      n.textContent = per * (r + 1);
      row.appendChild(n);
      el.appendChild(row);
    }
  }

  // Put the buddy's treat icon into every [data-treat] slot.
  function renderTreatSlots() {
    document.querySelectorAll("[data-treat]").forEach((slot) => {
      slot.replaceChildren(treatEl("treat"));
    });
  }

  // ---------- HOME ----------
  function starsHTML(s) {
    return [1, 2, 3].map((i) => `<span class="${i <= s ? "on" : ""}">★</span>`).join("");
  }

  function renderHome() {
    const grid = $("#tableGrid");
    grid.innerHTML = "";
    for (const n of L.TABLES) {
      const s = starsOf(n);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "table-card" + (n === selected ? " sel" : "") + (s === 3 ? " master" : "");
      b.style.setProperty("--c", colorOf(n));
      b.setAttribute("aria-pressed", n === selected);
      b.setAttribute("aria-label", t("tableAria", n, s));
      b.innerHTML =
        (s === 3 ? '<span class="crown" aria-hidden="true">👑</span>' : "") +
        `<span class="t-num" aria-hidden="true">×${n}</span>` +
        `<span class="stars" aria-hidden="true">${starsHTML(s)}</span>` +
        (proUnlocked(n) ? '<span class="pro-tag" aria-hidden="true">PRO</span>' : "");
      b.addEventListener("click", () => selectTable(n));
      grid.appendChild(b);
    }
    $("#selTitle").textContent = t("tableName", selected);
    $(".modes").style.setProperty("--c", colorOf(selected));
    $("#learnHint").textContent = t("learnHint", treatName());

    const pro = proUnlocked(selected);
    const btnPro = $("#btnPro");
    btnPro.classList.toggle("locked", !pro);
    btnPro.setAttribute("aria-disabled", !pro);
    $("#proEmoji").textContent = pro ? "⌨️" : "🔒";
    $("#proHint").textContent = pro ? t("proHint") : t("proLocked");

    $("#rushOneLabel").textContent = `⚡ ${t("tableShort", selected)}`;
    $("#rushOneBest").textContent = rushBest[selected] ? t("rushBest", rushBest[selected]) : "";
    $("#rushAllBest").textContent = rushBest.all ? t("rushBest", rushBest.all) : "";

    $("#basketLabel").textContent = t("basket", buddyName());
    $("#basketCount").textContent = treats;
    $("#basketCount").setAttribute("aria-label", `${treats} ${treatName(treats)}`);
    const total = L.totalStars(best);
    const ri = L.rankIndex(total);
    const ranks = t("ranks");
    $("#rankTitle").textContent = ranks[ri];
    $("#rankStars").textContent = total;
    $("#rankFill").style.width = `${(total / L.MAX_STARS) * 100}%`;
    $("#rankNext").textContent =
      ri + 1 < L.RANK_AT.length ? t("nextRank", L.RANK_AT[ri + 1] - total, ranks[ri + 1]) : t("maxRank");
  }

  function selectTable(n) {
    sfx("tap");
    selected = n;
    KidsStore.save(key("selected"), n);
    renderHome();
    const card = $("#tableGrid").children[n - 1];
    card.focus();
    card.classList.add("bounce");
    mHome.setMood("hop", 400);
    mHome.say(`${t("tableName", n)} ✨`, 1800);
  }

  let greetTimer = 0;
  function greet() {
    clearTimeout(greetTimer);
    greetTimer = setTimeout(() => mHome.say(pick(t("hello", buddyName(), treatName())), 4000), 400);
  }
  function goHome() {
    stopRush();
    renderHome();
    show("home");
    mHome.setMood("idle");
    greet();
  }

  $("#mascotHome").addEventListener("click", () => poke(mHome));
  $("#btnLearn").addEventListener("click", () => startLearn(selected));
  $("#btnPractice").addEventListener("click", () => startPlay("practice", [selected]));
  $("#btnPro").addEventListener("click", (e) => {
    if (!proUnlocked(selected)) {
      sfx("tap");
      restart(e.currentTarget, "shake");
      mHome.setMood("think", 1400);
      mHome.say(t("proLocked"), 2400);
      return;
    }
    startPlay("pro", [selected]);
  });
  $("#btnRushOne").addEventListener("click", () => startPlay("rush", [selected]));
  $("#btnRushAll").addEventListener("click", () => startPlay("rush", []));

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

  // ---------- LEARN ----------
  const learn = { n: 1, b: 1 };

  function startLearn(n) {
    sfx("tap");
    learn.n = n;
    learn.b = 1;
    show("learn");
    document.documentElement.style.setProperty("--tc", colorOf(n));
    renderLearn(0);
  }

  function renderLearn(animateFrom, talk = true) {
    const { n, b } = learn;
    const ans = n * b;
    $("#learnTitle").textContent = t("learnTitle", n);
    $("#groupsLabel").textContent = t("groupsOf", b, n);
    renderArray($("#learnArray"), n, b, animateFrom);
    const eq = $("#learnEq");
    eq.innerHTML = `<span>${n}</span> × <span>${b}</span> = <b>${ans}</b>`;
    eq.setAttribute("aria-label", t("say", n, b, ans));
    $("#skipRow").innerHTML = L.skipCount(n)
      .map((v, i) => `<span class="${i < b - 1 ? "done" : i === b - 1 ? "now" : ""}">${v}</span>`)
      .join("");
    $("#learnStep").textContent = t("step", b);
    $("#learnPrev").disabled = b === 1;
    $("#learnNext").hidden = b === 10;
    $("#learnPractice").hidden = b !== 10;
    if (talk) {
      mLearn.setMood(b === 10 ? "happy" : "hop", b === 10 ? 1500 : 400);
      mLearn.say(t("explain", n, b, ans, treatName(n)), 0);
      speak(t("say", n, b, ans));
    }
  }

  function learnStep(d) {
    const nb = learn.b + d;
    if (nb < 1 || nb > 10) return;
    sfx(d > 0 ? "chirp" : "tap");
    learn.b = nb;
    renderLearn(d > 0 ? nb - 1 : 0);
    if (nb === 10) setTimeout(() => $("#learnPractice").focus(), 50);
  }
  $("#learnPrev").addEventListener("click", () => learnStep(-1));
  $("#learnNext").addEventListener("click", () => learnStep(1));
  $("#learnBack").addEventListener("click", goHome);
  $("#btnSpeak").addEventListener("click", () => {
    const { n, b } = learn;
    speak(t("say", n, b, n * b));
    chomp(mLearn, 3);
  });
  $("#learnPractice").addEventListener("click", () => startPlay("practice", [learn.n]));
  $("#mascotLearn").addEventListener("click", () => poke(mLearn));

  // ---------- PLAY: practice, pro, rush ----------
  const play = {
    mode: "practice",
    tables: [],
    queue: [],
    facts: [],
    q: null,
    locked: false,
    firstTry: 0,
    earned: 0,
    streak: 0,
    typed: "",
    score: 0,
    endAt: 0,
    timer: 0,
    started: false,
  };

  function startPlay(mode, tables) {
    sfx("tap");
    stopRush();
    Object.assign(play, {
      mode,
      tables,
      locked: false,
      firstTry: 0,
      earned: 0,
      streak: 0,
      typed: "",
      score: 0,
      bonuses: 0,
      q: null,
      started: false,
    });
    const rush = mode === "rush";
    const n = tables[0];
    document.documentElement.style.setProperty("--tc", n ? colorOf(n) : "#ffd84d");
    $("#dots").hidden = rush;
    $("#timer").hidden = !rush;
    $("#choices").hidden = mode === "pro";
    $("#pad").hidden = mode !== "pro";
    $("#treatNow").textContent = treats;
    $("#rushScore").textContent = 0;
    renderStreak();
    show("play");
    renderPlayTitle();
    mPlay.setMood("idle");
    mPlay.hush();
    if (rush) {
      play.facts = [];
      play.queue = [];
      $("#timer").classList.remove("hurry");
      $("#timerFill").style.width = "100%";
      $("#timerText").textContent = "60";
      $("#question").textContent = t("ready");
      $("#choices").innerHTML = "";
      $("#feedback").textContent = "";
      $("#hint").hidden = true;
      $("#btnGotIt").hidden = true;
      mPlay.setMood("wow", 900);
      play.timer = setTimeout(() => {
        play.started = true;
        play.endAt = performance.now() + RUSH_MS;
        play.timer = setInterval(tickRush, 100);
        play.queue = [L.rushQuestion(tables, null)];
        ask();
      }, 1100);
      return;
    }
    play.facts = L.practiceRound(n).map((f, i) => ({ ...f, dot: i, misses: 0, state: "" }));
    play.queue = play.facts.slice();
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
    $("#treatPill").setAttribute("aria-label", t("basket", buddyName()) + `: ${treats} ${treatName(treats)}`);
  }

  function renderDots() {
    const el = $("#dots");
    el.innerHTML = "";
    const done = play.facts.filter((f) => f.state === "good" || f.state === "fixed").length;
    el.setAttribute("aria-valuenow", done);
    el.setAttribute("aria-label", t("progressAria", Math.min(done + 1, L.ROUND), L.ROUND));
    for (const f of play.facts) {
      const d = document.createElement("span");
      d.className = "dot " + f.state + (play.q && play.q.dot === f.dot ? " now" : "");
      if (f.state === "good") d.appendChild(treatEl("treat"));
      else if (f.state === "fixed") d.textContent = "✓";
      el.appendChild(d);
    }
  }

  function renderStreak() {
    const el = $("#streak");
    if (play.streak >= 2) {
      el.textContent = t("streak", play.streak);
      el.classList.add("on");
      restart(el, "pop");
    } else {
      el.classList.remove("on");
    }
  }

  function ask() {
    play.q = play.queue.shift();
    play.locked = false;
    play.typed = "";
    const { a, b } = play.q;
    const qEl = $("#question");
    qEl.textContent = t("question", a, b);
    restart(qEl, "in");
    $("#hint").hidden = true;
    $("#btnGotIt").hidden = true;
    $("#feedback").textContent = "";
    $("#qCard").classList.remove("good", "oops");
    if (play.mode === "pro") renderPad();
    else renderChoices();
    if (play.mode !== "rush") renderDots();
  }

  function renderChoices() {
    const { a, b } = play.q;
    const el = $("#choices");
    el.innerHTML = "";
    L.choices(a, b).forEach((v, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice";
      btn.dataset.v = v;
      btn.setAttribute("aria-label", t("choiceAria", v, i + 1));
      btn.innerHTML = `<small aria-hidden="true">${i + 1}</small>${v}`;
      btn.addEventListener("click", () => answer(v, btn));
      el.appendChild(btn);
    });
  }

  // Big on-screen number pad for Pro mode.
  function renderPad() {
    const keys = $("#padKeys");
    if (!keys.children.length) {
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"].forEach((k) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "key" + (k === "✓" ? " ok" : k === "⌫" ? " del" : "");
        btn.textContent = k;
        btn.addEventListener("click", () => padKey(k));
        keys.appendChild(btn);
      });
    }
    keys.querySelector(".del").setAttribute("aria-label", t("clear"));
    keys.querySelector(".ok").setAttribute("aria-label", t("check"));
    const d = $("#padDisplay");
    d.classList.remove("bad", "right", "wrong", "shake");
    renderTyped();
  }

  function renderTyped() {
    const d = $("#padDisplay");
    d.textContent = play.typed || "?";
    d.classList.toggle("empty", !play.typed);
    d.setAttribute("aria-label", `${t("typeAnswer")}: ${play.typed}`);
  }

  function padKey(k) {
    if (play.locked) return;
    if (k === "⌫") {
      play.typed = play.typed.slice(0, -1);
      sfx("tap");
    } else if (k === "✓") {
      if (!play.typed) return restart($("#padDisplay"), "shake");
      answer(Number(play.typed), $("#padDisplay"));
      return;
    } else if (play.typed.length < 3) {
      play.typed = (play.typed === "0" ? "" : play.typed) + k;
      sfx("tap");
    }
    renderTyped();
  }

  function answer(v, el) {
    if (play.locked) return;
    if (v === play.q.answer) onRight(play.q, el);
    else onWrong(play.q, el);
  }

  function onRight(q, el) {
    play.locked = true;
    sfx("correct");
    play.streak++;
    play.earned++;
    addTreats(1);
    el.classList.add("right");
    $("#qCard").classList.add("good");
    $("#question").textContent = t("correctIs", q.a, q.b, q.answer);
    KidsFx.burstFrom(el, [treatIcon(), "⭐", "✨"], 10);
    flyTreat(el);
    mPlay.setMood("happy", 900);
    chomp(mPlay);
    const praise = play.streak >= 3 && play.streak % 3 === 0 ? t("streakSay", play.streak) : pick(t("praise"));
    mPlay.say(praise, 1100);
    $("#feedback").textContent = praise;
    renderStreak();

    if (play.mode === "rush") {
      play.score++;
      $("#rushScore").textContent = play.score;
      restart($("#rushScore").parentElement, "pop");
      if (play.streak % 5 === 0 && play.bonuses < MAX_BONUSES) rushBonus();
      setTimeout(nextRush, 550);
      return;
    }
    if (q.misses === 0) {
      q.state = "good";
      play.firstTry++;
    } else {
      q.state = "fixed";
    }
    renderDots();
    setTimeout(nextPractice, 850);
  }

  function onWrong(q, el) {
    play.locked = true;
    sfx("wrong");
    play.streak = 0;
    renderStreak();
    restart(el, "shake");
    el.classList.add("wrong");
    const right = document.querySelector(`.choice[data-v="${q.answer}"]`);
    if (right) right.classList.add("reveal");
    $("#qCard").classList.add("oops");
    $("#question").textContent = t("correctIs", q.a, q.b, q.answer);
    mPlay.setMood("think", 2200);
    const oops = pick(t("oops"));
    mPlay.say(oops, 2200);

    if (play.mode === "rush") {
      $("#feedback").textContent = oops;
      setTimeout(nextRush, 1100);
      return;
    }
    // Practice: show the treat-array hint, re-ask this fact later in the round.
    q.misses++;
    $("#hint").hidden = false;
    renderArray($("#hintArray"), q.a, q.b);
    $("#hintLine").textContent = t("hintLine", q.a, q.b, q.answer);
    if (q.misses <= 2) {
      q.state = "retry";
      play.queue.splice(Math.min(play.queue.length, 2), 0, q);
      $("#feedback").textContent = `${oops} ${t("again")}`;
    } else {
      q.state = "fixed";
      $("#feedback").textContent = oops;
    }
    renderDots();
    const got = $("#btnGotIt");
    got.hidden = false;
    setTimeout(() => got.focus({ preventScroll: true }), 30);
  }

  $("#btnGotIt").addEventListener("click", () => {
    sfx("tap");
    nextPractice();
  });

  function nextPractice() {
    if (current !== "play") return;
    if (play.queue.length) ask();
    else finishPractice();
  }

  // A treat flies from the answer into the treat counter in the header.
  function flyTreat(from) {
    const pill = $("#treatPill");
    const done = () => {
      $("#treatNow").textContent = treats;
      restart(pill, "pop");
    };
    if (reduced()) return done();
    const f = from.getBoundingClientRect();
    const to = pill.getBoundingClientRect();
    const s = treatEl("fly");
    s.style.left = `${f.left + f.width / 2}px`;
    s.style.top = `${f.top + f.height / 2}px`;
    document.body.appendChild(s);
    void s.offsetWidth;
    const dx = to.left + 18 - f.left - f.width / 2;
    const dy = to.top + to.height / 2 - f.top - f.height / 2;
    s.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(540deg) scale(0.7)`;
    setTimeout(() => {
      s.remove();
      done();
    }, 650);
  }

  // ---------- rush ----------
  function tickRush() {
    const left = Math.max(0, play.endAt - performance.now());
    const secs = Math.ceil(left / 1000);
    $("#timerFill").style.width = `${Math.min(100, (left / RUSH_MS) * 100)}%`;
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
    b.className = "bonus";
    b.textContent = t("timeBonus");
    $("#timer").appendChild(b);
    setTimeout(() => b.remove(), 1200);
    treatRain();
  }

  function treatRain() {
    for (let i = 0; i < 6; i++) {
      setTimeout(
        () => KidsFx.burst(Math.random() * innerWidth, 60 + Math.random() * 120, [treatIcon(), treatIcon(), "⭐"], 6),
        i * 90,
      );
    }
  }

  function nextRush() {
    if (current !== "play" || !play.started) return;
    play.queue = [L.rushQuestion(play.tables, play.q)];
    ask();
  }

  function stopRush() {
    clearTimeout(play.timer);
    clearInterval(play.timer);
    play.timer = 0;
    play.started = false;
  }

  // ---------- keyboard ----------
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
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
      const btn = $("#choices").children[Number(e.key) - 1];
      if (btn) btn.click();
    }
  });

  $("#playBack").addEventListener("click", () => {
    sfx("tap");
    goHome();
  });
  $("#mascotPlay").addEventListener("click", () => poke(mPlay));

  // ---------- RESULTS ----------
  let last = null;

  function finishPractice() {
    const n = play.tables[0];
    const stars = L.starsFor(play.firstTry);
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
      firstTry: play.firstTry,
      earned: play.earned,
      proNew: prev < 2 && stars >= 2,
      masterNew: prev < 3 && stars === 3,
    };
    show("results");
    renderResults(true);
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
    show("results");
    renderResults(true);
  }

  function renderResults(animate) {
    const r = last;
    if (!r) return;
    const rush = r.mode === "rush";
    const starsEl = $("#bigStars");
    starsEl.hidden = rush;
    $("#bigScore").hidden = !rush;
    const badges = [];
    if (r.earned) badges.push(t("treatsEarned", r.earned, treatName(r.earned), buddyName()));
    if (rush) {
      $("#bigScore").textContent = `⭐ ${r.score}`;
      $("#resultLine").textContent = t("resultRush", r.score);
      $("#resultSub").textContent = (r.record ? t("newRecord") + " · " : "") + t("rushBestLine", r.best);
      const lvl = r.record ? 2 : r.score >= 10 ? 1 : 0;
      if (animate) {
        mResult.setMood(lvl ? "happy" : "hop", lvl ? 0 : 500);
        if (lvl === 2) {
          sfx("fanfare");
          KidsFx.confetti();
          restart($("#bigScore"), "pop");
        } else sfx("level");
      }
      mResult.say(t("rushLines")[lvl], 0);
    } else {
      $("#resultLine").textContent = t("resultPractice", r.firstTry, L.ROUND);
      $("#resultSub").textContent = "";
      starsEl.setAttribute("aria-label", t("stars", r.stars));
      if (r.proNew) badges.push(t("proUnlocked"));
      if (r.masterNew) badges.push(t("master", r.n));
      const spans = [...starsEl.children];
      if (animate) {
        spans.forEach((s) => s.classList.remove("on", "dim"));
        spans.forEach((s, i) =>
          setTimeout(() => {
            s.classList.add(i < r.stars ? "on" : "dim");
            if (i < r.stars) sfx("star");
          }, 500 + i * 450),
        );
        setTimeout(() => {
          if (current === "results" && r.stars >= 2) {
            sfx("fanfare");
            KidsFx.confetti();
          }
        }, 500 + 3 * 450);
        mResult.setMood(r.stars >= 2 ? "happy" : "hop", r.stars >= 2 ? 0 : 500);
      } else {
        spans.forEach((s, i) => s.classList.add(i < r.stars ? "on" : "dim"));
      }
      mResult.say(t("results", cap(treatName(1)), treatName())[r.stars], 0);
    }
    const bEl = $("#badges");
    bEl.innerHTML = "";
    badges.forEach((text, i) => {
      const b = document.createElement("span");
      b.className = "badge";
      if (i === 0 && r.earned) b.appendChild(treatEl("treat"));
      b.append(text);
      bEl.appendChild(b);
    });
    if (animate) setTimeout(() => $("#btnAgain").focus(), 60);
  }

  $("#btnAgain").addEventListener("click", () => {
    if (!last) return goHome();
    startPlay(last.mode, last.tables);
  });
  $("#btnTables").addEventListener("click", () => {
    sfx("tap");
    goHome();
  });

  // ---------- language & buddy changes ----------
  function renderStatic() {
    KidsI18n.apply(TT_I18N);
    document.title = t("docTitle", buddyName());
    $("#logoName").textContent = buddyName();
    renderTreatSlots();
    renderSound();
  }

  function rerender() {
    renderStatic();
    if (current === "home") {
      renderHome();
      greet();
    } else if (current === "learn") {
      renderLearn(learn.b, true);
    } else if (current === "play") {
      renderPlayTitle();
      $("#treatNow").textContent = treats;
      if (play.q && !play.locked) {
        $("#question").textContent = t("question", play.q.a, play.q.b);
        if (play.mode === "pro") renderPad();
      }
      if (play.mode !== "rush" && play.facts.length) renderDots();
      renderStreak();
    } else if (current === "results") {
      renderResults(false);
    }
  }
  KidsI18n.onChange(rerender);
  Mascots.onBuddyChange((id) => {
    buddyId = id;
    allMascots.forEach((m) => m.use(id));
    rerender();
    const m = { home: mHome, learn: mLearn, play: mPlay, results: mResult }[current];
    m.sound();
    m.setMood("hop", 500);
  });

  // ---------- boot ----------
  renderStatic();
  goHome();
})();
