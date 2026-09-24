// UI for the words game. Logic lives in logic.js (WordsLogic), words in
// words.js (WORD_PACKS). Playable with any mascot ("buddy"); Pipo is the
// default. The UI language is the "home" language; the words are shown and
// spoken in the target language (the other one, or home to practise reading).
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const t = KidsI18n.translator(WORDS_I18N);
  const L = WordsLogic;
  const PACKS = WORD_PACKS;
  const GAME = "words";
  const DEFAULT_BUDDY = "pipo";
  const MAX_STARS = L.maxStars(PACKS);
  const WORDS = new Map(PACKS.flatMap((p) => p.words.map((w) => [w.id, w])));
  const ALL_COUNT = WORDS.size;
  const FLAGS = { en: "🇬🇧", es: "🇪🇸" };
  const VOICES = { en: "en-US", es: "es-ES" };
  const MODE_EMOJI = { listen: "👂", picture: "🖼️", spell: "🔤", memory: "🃏" };
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const restart = (el, cls) => {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  };

  // ---------- buddy ----------
  let buddyId = Mascots.buddy(DEFAULT_BUDDY);
  const def = () => Mascots.get(buddyId);
  const buddyName = () => KidsI18n.pickLang(def().name);
  const treatName = (count = 2) => Mascots.treatName(def(), count);
  const treatIcon = () => Mascots.treatOf(def()).icon;

  // ---------- persisted state ----------
  const key = (k) => `${GAME}.${k}`;
  const best = KidsStore.load(key("stars"), {});
  const learned = KidsStore.load(key("learned"), {});
  let targetMode =
    KidsStore.load(key("target"), "other") === "home" ? "home" : "other";
  let ghost = KidsStore.load(key("ghost"), false) === true;
  let packId = KidsStore.load(key("pack"), PACKS[0].id);
  if (!PACKS.some((p) => p.id === packId)) packId = PACKS[0].id;

  const pack = () => PACKS.find((p) => p.id === packId);
  const target = () => L.targetLang(KidsI18n.get(), targetMode);
  const home = () => KidsI18n.get();
  const langName = (code) => t("langName")[code];
  const modeStars = (pid, mode) =>
    Math.min(3, (best[pid] && best[pid][mode]) || 0);
  const learnedCount = (words) => words.filter((w) => learned[w.id]).length;

  function saveStars() {
    KidsStore.save(key("stars"), best);
    KidsStore.setProgress(GAME, L.totalStars(best, PACKS), MAX_STARS);
  }
  KidsStore.setProgress(GAME, L.totalStars(best, PACKS), MAX_STARS);

  // ---------- mascots ----------
  const mHome = Mascots.create($("#mascotHome"), $("#bubbleHome"), buddyId);
  const mPack = Mascots.create($("#mascotPack"), $("#bubblePack"), buddyId);
  const mPlay = Mascots.create($("#mascotPlay"), $("#bubblePlay"), buddyId);
  const mResult = Mascots.create(
    $("#mascotResult"),
    $("#bubbleResult"),
    buddyId,
  );
  const allMascots = [mHome, mPack, mPlay, mResult];

  function talk(m, times = 3) {
    let i = 0;
    const step = () => {
      m.mouth(i % 2 ? 0 : 0.8);
      if (++i < times * 2) setTimeout(step, 110);
      else m.mouth(0);
    };
    step();
  }
  function poke(m) {
    m.sound();
    talk(m, 2);
    m.setMood("happy", 900);
    m.say(pick(t("poke", cap(treatName()))), 1800);
  }

  // ---------- sound & voice ----------
  document.addEventListener("pointerdown", () => KidsAudio.ensure(), true);
  document.addEventListener("keydown", () => KidsAudio.ensure(), true);
  const sfx = (name) => KidsAudio.sfx(name);
  const hasSpeech = () =>
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function";
  const canSpeak = () => !KidsAudio.isMuted() && hasSpeech();

  // Say a word in its own language. Silent (and harmless) without speech.
  function speak(text, lang) {
    if (!canSpeak()) return false;
    try {
      const code = VOICES[lang] || "en-US";
      const u = new SpeechSynthesisUtterance(text);
      u.lang = code;
      u.rate = 0.85;
      u.pitch = 1.1;
      const voices = speechSynthesis.getVoices() || [];
      const v =
        voices.find((x) => x.lang === code) ||
        voices.find((x) => x.lang && x.lang.replace("_", "-").startsWith(lang));
      if (v) u.voice = v;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      return true;
    } catch {
      return false;
    }
  }
  function hushVoice() {
    try {
      if (hasSpeech()) speechSynthesis.cancel();
    } catch {}
  }
  const sayWord = (w, lang = target()) => speak(L.textOf(w, lang), lang);

  // ---------- word rendering ----------
  // Picture: a painted dot for colours, the emoji otherwise.
  function pictureEl(w, cls = "pic") {
    const el = document.createElement("span");
    el.className = cls;
    el.setAttribute("aria-hidden", "true");
    if (w.swatch) {
      el.classList.add("swatch");
      el.style.setProperty("--sw", w.swatch);
    } else {
      el.textContent = w.emoji;
    }
    return el;
  }
  // Word text with the Spanish article a little smaller: "el perro".
  function wordEl(w, lang = target(), cls = "word") {
    const el = document.createElement("span");
    el.className = cls;
    el.lang = lang;
    const { article, word } = L.splitArticle(L.textOf(w, lang), lang);
    if (article) {
      const a = document.createElement("span");
      a.className = "art";
      a.textContent = article;
      el.append(a, " ");
    }
    el.append(word);
    return el;
  }
  const starsHTML = (s) =>
    [1, 2, 3]
      .map((i) => `<span class="${i <= s ? "on" : ""}">★</span>`)
      .join("");

  // ---------- screens ----------
  let current = "home";
  function show(id) {
    hushVoice();
    // Confetti belongs to the screen that threw it.
    document.querySelectorAll(".kids-confetti").forEach((c) => c.remove());
    document
      .querySelectorAll(".screen")
      .forEach((s) => s.classList.toggle("active", s.id === id));
    current = id;
    window.scrollTo(0, 0);
  }
  function setPackColor() {
    document.documentElement.style.setProperty("--pc", pack().color);
  }

  // ---------- HOME ----------
  function renderTarget() {
    const tl = target();
    $("#targetLabel").textContent =
      targetMode === "home" ? t("practising") : t("learning");
    $("#targetFlag").textContent = FLAGS[tl];
    $("#targetName").textContent = t("targetBtn", langName(tl));
    $("#btnTarget").setAttribute("aria-label", t("targetAria", langName(tl)));
    $("#btnTarget").classList.toggle("home", targetMode === "home");
  }

  function renderHome() {
    renderTarget();
    const total = L.totalStars(best, PACKS);
    $("#totalStars").textContent = total;
    $("#maxStars").textContent = MAX_STARS;
    $("#totalFill").style.width = `${(total / MAX_STARS) * 100}%`;
    $("#bookCount").textContent = t(
      "stickersCount",
      Object.keys(learned).filter((id) => WORDS.has(id)).length,
      ALL_COUNT,
    );

    const grid = $("#packGrid");
    grid.innerHTML = "";
    const perPack = L.MODES.length * 3;
    for (const p of PACKS) {
      const s = L.packStars(best, p.id);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pack-card" + (p.id === packId ? " sel" : "");
      b.style.setProperty("--c", p.color);
      const name = KidsI18n.pickLang(p.name);
      b.setAttribute("aria-label", t("packAria", name, s, perPack));
      b.innerHTML =
        (s === perPack
          ? '<span class="crown" aria-hidden="true">👑</span>'
          : "") +
        `<span class="pack-emoji" aria-hidden="true">${p.emoji}</span>` +
        `<span class="pack-name" aria-hidden="true"></span>` +
        `<span class="pack-stars" aria-hidden="true">⭐ ${s}/${perPack}</span>`;
      b.querySelector(".pack-name").textContent = name;
      b.addEventListener("click", () => openPack(p.id));
      grid.appendChild(b);
    }
  }

  let greetTimer = 0;
  function greet() {
    clearTimeout(greetTimer);
    greetTimer = setTimeout(() => {
      const lines =
        targetMode === "home"
          ? t("helloHome", buddyName(), langName(target()))
          : t("hello", buddyName(), langName(target()), treatName());
      mHome.say(pick(lines), 4000);
    }, 400);
  }
  function goHome() {
    renderHome();
    show("home");
    mHome.setMood("idle");
    greet();
  }

  $("#mascotHome").addEventListener("click", () => poke(mHome));
  $("#btnTarget").addEventListener("click", () => {
    sfx("tap");
    targetMode = targetMode === "home" ? "other" : "home";
    KidsStore.save(key("target"), targetMode);
    renderTarget();
    restart($("#btnTarget"), "pop-sm");
    mHome.setMood("hop", 500);
    greet();
  });
  $("#btnBook").addEventListener("click", openBook);

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

  // ---------- PACK ----------
  function openPack(id) {
    sfx("tap");
    packId = id;
    KidsStore.save(key("pack"), id);
    setPackColor();
    renderPack();
    show("pack");
    mPack.setMood("hop", 500);
    mPack.say(t("packHello", KidsI18n.pickLang(pack().name)), 2600);
  }

  function renderPack() {
    const p = pack();
    const tl = target();
    $("#packTitle").textContent = `${p.emoji} ${KidsI18n.pickLang(p.name)}`;
    $("#packStars").textContent =
      `⭐ ${L.packStars(best, p.id)}/${L.MODES.length * 3}`;

    const grid = $("#modeGrid");
    grid.innerHTML = "";
    for (const mode of L.MODES) {
      const s = modeStars(p.id, mode);
      const b = document.createElement("button");
      b.type = "button";
      b.className = `mode mode-${mode}`;
      b.setAttribute("aria-label", t("modeAria", t(`modes.${mode}`), s));
      b.innerHTML =
        `<span class="mode-emoji" aria-hidden="true">${MODE_EMOJI[mode]}</span>` +
        `<b aria-hidden="true"></b><small aria-hidden="true"></small>` +
        `<span class="stars" aria-hidden="true">${starsHTML(s)}</span>`;
      b.querySelector("b").textContent = t(`modes.${mode}`);
      b.querySelector("small").textContent = t(`modeHints.${mode}`);
      b.addEventListener("click", () => startPlay(mode));
      grid.appendChild(b);
    }

    $("#galleryTitle").textContent = canSpeak()
      ? t("tapToHear")
      : t("tapToSee");
    const gal = $("#gallery");
    gal.innerHTML = "";
    for (const w of p.words) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "word-card" + (learned[w.id] ? " got" : "");
      b.setAttribute("aria-label", L.textOf(w, tl));
      b.appendChild(pictureEl(w));
      b.appendChild(wordEl(w, tl));
      if (tl !== home()) b.appendChild(wordEl(w, home(), "trans"));
      b.addEventListener("click", () => {
        sayWord(w, tl);
        restart(b, "pop-sm");
        talk(mPack, 2);
        const say =
          L.textOf(w, tl) + (tl !== home() ? ` = ${L.textOf(w, home())}` : "");
        mPack.say(`${w.swatch ? "🎨" : w.emoji} ${say}`, 2400);
      });
      gal.appendChild(b);
    }
  }
  $("#packBack").addEventListener("click", () => {
    sfx("tap");
    goHome();
  });
  $("#mascotPack").addEventListener("click", () => poke(mPack));

  // ---------- PLAY ----------
  const play = {
    mode: "listen",
    lang: "es",
    items: [],
    queue: [],
    q: null,
    opts: [],
    locked: false,
    mistakes: 0,
    newStickers: [],
    // spell
    letters: [],
    pos: 0,
    tiles: [],
    slotMisses: 0,
    // memory
    deck: [],
    open: [],
    matched: new Set(),
    tries: 0,
    timer: 0,
  };

  function startPlay(mode) {
    sfx("tap");
    clearTimeout(play.timer);
    const p = pack();
    const lang = target();
    const ids = L.makeRound(mode, p.words, lang);
    Object.assign(play, {
      mode,
      lang,
      items: ids.map((id, i) => ({ id, dot: i, misses: 0, state: "" })),
      q: null,
      opts: [],
      locked: false,
      mistakes: 0,
      newStickers: [],
      open: [],
      matched: new Set(),
      tries: 0,
    });
    play.queue = play.items.slice();
    setPackColor();
    show("play");
    renderPlayTitle();
    mPlay.setMood("idle");
    mPlay.hush();
    const memory = mode === "memory";
    $("#dots").hidden = memory;
    $("#pairsPill").hidden = !memory;
    $("#qCard").classList.toggle("slim", memory);
    $("#choices").hidden = memory || mode === "spell";
    $("#choices").className = `choices ${mode}`;
    $("#tiles").hidden = mode !== "spell";
    $("#spellRow").hidden = mode !== "spell";
    $("#board").hidden = !memory;
    $("#btnNext").hidden = true;
    $("#feedback").textContent = "";
    if (memory) startMemory(ids);
    else ask();
  }

  function renderPlayTitle() {
    $("#playTitle").textContent =
      `${MODE_EMOJI[play.mode]} ${t(`modes.${play.mode}`)} · ${KidsI18n.pickLang(pack().name)}`;
  }

  function renderDots() {
    const el = $("#dots");
    el.innerHTML = "";
    const done = play.items.filter(
      (f) => f.state === "good" || f.state === "fixed",
    ).length;
    el.setAttribute("aria-valuemax", play.items.length);
    el.setAttribute("aria-valuenow", done);
    el.setAttribute(
      "aria-label",
      t(
        "progressAria",
        Math.min(done + 1, play.items.length),
        play.items.length,
      ),
    );
    for (const f of play.items) {
      const d = document.createElement("span");
      d.className =
        "dot " + f.state + (play.q && play.q.dot === f.dot ? " now" : "");
      if (f.state === "good") d.textContent = "★";
      else if (f.state === "fixed") d.textContent = "✓";
      el.appendChild(d);
    }
  }

  const word = (item) => WORDS.get(item.id);

  function ask() {
    play.q = play.queue.shift();
    play.locked = false;
    const w = word(play.q);
    $("#btnNext").hidden = true;
    $("#feedback").textContent = "";
    $("#qCard").classList.remove("good", "oops");
    const others = pack().words;
    if (play.mode === "listen")
      play.opts = L.options(w, others, L.OPTIONS.listen, play.lang).map(
        (o) => o.id,
      );
    if (play.mode === "picture")
      play.opts = L.options(w, others, L.OPTIONS.picture, play.lang).map(
        (o) => o.id,
      );
    renderQuestion(true);
    renderDots();
    restart($("#qCard"), "in");
  }

  // Draw the current question (also used after a language/buddy change).
  function renderQuestion(fresh) {
    const w = word(play.q);
    const lang = play.lang;
    const vis = $("#qVisual");
    const qWord = $("#qWord");
    vis.innerHTML = "";
    qWord.innerHTML = "";
    qWord.classList.remove("show", "quiet");
    if (play.mode === "listen") {
      $("#qPrompt").textContent = t("listenQ");
      const hear = document.createElement("button");
      hear.type = "button";
      hear.className = "hear-btn";
      hear.id = "btnHear";
      hear.textContent = "🔊";
      hear.setAttribute("aria-label", t("hear"));
      hear.addEventListener("click", () => {
        if (!sayWord(w, lang)) showListenWord();
        restart(hear, "pop-sm");
      });
      vis.appendChild(hear);
      if (!canSpeak()) showListenWord();
      renderChoices();
      if (fresh)
        setTimeout(
          () =>
            current === "play" &&
            play.q &&
            play.q.id === w.id &&
            sayWord(w, lang),
          350,
        );
    } else if (play.mode === "picture") {
      $("#qPrompt").textContent = t("pictureQ");
      vis.appendChild(pictureEl(w, "q-pic"));
      renderChoices();
    } else if (play.mode === "spell") {
      $("#qPrompt").textContent = t("spellQ");
      vis.appendChild(pictureEl(w, "q-pic small"));
      const hear = document.createElement("button");
      hear.type = "button";
      hear.className = "hear-btn mini";
      hear.textContent = "🔊";
      hear.setAttribute("aria-label", t("hear"));
      hear.hidden = !canSpeak();
      hear.addEventListener("click", () => sayWord(w, lang));
      vis.appendChild(hear);
      startSpell(w);
    }
  }

  // Listen mode without sound: show the written word instead.
  function showListenWord() {
    const q = $("#qWord");
    q.innerHTML = "";
    q.appendChild(wordEl(word(play.q), play.lang));
    const note = document.createElement("small");
    note.textContent = t("noSound");
    q.appendChild(note);
    q.classList.add("show", "quiet");
  }

  function renderChoices() {
    const el = $("#choices");
    el.innerHTML = "";
    play.opts.forEach((id, i) => {
      const w = WORDS.get(id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice";
      btn.dataset.id = id;
      if (play.mode === "listen") {
        // Named in the home language so the picture isn't given away in the target one.
        btn.setAttribute(
          "aria-label",
          t("choiceAria", L.textOf(w, home()), i + 1),
        );
        btn.appendChild(pictureEl(w));
      } else {
        btn.setAttribute(
          "aria-label",
          t("choiceAria", L.textOf(w, play.lang), i + 1),
        );
        btn.appendChild(wordEl(w, play.lang));
      }
      const k = document.createElement("small");
      k.className = "key";
      k.setAttribute("aria-hidden", "true");
      k.textContent = i + 1;
      btn.appendChild(k);
      btn.addEventListener("click", () => answer(id, btn));
      el.appendChild(btn);
    });
  }

  function answer(id, btn) {
    if (play.locked) return;
    play.locked = true;
    const q = play.q;
    const w = word(q);
    const qWord = $("#qWord");
    qWord.innerHTML = "";
    qWord.appendChild(wordEl(w, play.lang));
    if (play.lang !== home()) qWord.appendChild(wordEl(w, home(), "trans"));
    qWord.classList.remove("quiet");
    qWord.classList.add("show");
    if (id === q.id) {
      sfx("correct");
      btn.classList.add("right");
      $("#qCard").classList.add("good");
      sayWord(w, play.lang);
      KidsFx.burstFrom(btn, [treatIcon(), "⭐", "✨"], 10);
      const praise = pick(t("praise"));
      mPlay.setMood("happy", 900);
      talk(mPlay);
      mPlay.say(praise, 1200);
      $("#feedback").textContent = praise;
      finishItem(q);
      play.timer = setTimeout(nextQuestion, 1300);
    } else {
      sfx("wrong");
      play.mistakes++;
      q.misses++;
      restart(btn, "shake");
      btn.classList.add("wrong");
      const right = $(`#choices .choice[data-id="${q.id}"]`);
      if (right) right.classList.add("reveal");
      $("#qCard").classList.add("oops");
      setTimeout(() => current === "play" && sayWord(w, play.lang), 450);
      const oops = pick(t("oops", L.textOf(w, play.lang)));
      mPlay.setMood("think", 2200);
      mPlay.say(oops, 2600);
      if (q.misses <= 2) {
        q.state = "retry";
        play.queue = L.requeue(play.queue, q);
        $("#feedback").textContent = `${oops} ${t("again")}`;
      } else {
        q.state = "fixed";
        $("#feedback").textContent = oops;
      }
      renderDots();
      const next = $("#btnNext");
      next.hidden = false;
      setTimeout(() => next.focus({ preventScroll: true }), 30);
    }
  }

  // Word done: a star dot (and a sticker) if right the first time.
  function finishItem(q) {
    if (q.misses === 0) {
      q.state = "good";
      collect(q.id);
    } else {
      q.state = "fixed";
    }
    renderDots();
  }

  function collect(id) {
    if (learned[id]) return;
    learned[id] = 1;
    KidsStore.save(key("learned"), learned);
    play.newStickers.push(id);
  }

  function nextQuestion() {
    clearTimeout(play.timer);
    if (current !== "play") return;
    if (play.queue.length) ask();
    else finishRound();
  }
  $("#btnNext").addEventListener("click", () => {
    sfx("tap");
    nextQuestion();
  });

  // ---------- spell ----------
  function startSpell(w) {
    const { article, word: text } = L.splitArticle(
      L.textOf(w, play.lang),
      play.lang,
    );
    play.article = article;
    play.letters = L.lettersOf(text);
    // Pre-fill the first letter as a hint.
    play.pos = 0;
    play.filled = play.letters.map((l) => l.fixed);
    const firstIdx = play.letters.findIndex((l) => !l.fixed);
    play.filled[firstIdx] = true;
    play.given = firstIdx;
    play.tiles = L.spellTiles(text, play.lang, { given: 1 }).map((tl) => ({
      ...tl,
      used: false,
    }));
    play.slotMisses = 0;
    renderSpell();
    renderTiles();
  }

  const nextSlot = () => play.filled.findIndex((f) => !f);

  function renderSpell() {
    const row = $("#spellRow");
    row.innerHTML = "";
    const n =
      play.letters.length + (play.article ? play.article.length * 0.6 + 1 : 0);
    row.style.setProperty("--n", Math.max(5, n));
    if (play.article) {
      const a = document.createElement("span");
      a.className = "slot-art";
      a.lang = play.lang;
      a.textContent = play.article;
      row.appendChild(a);
    }
    const now = nextSlot();
    play.letters.forEach((l, i) => {
      const s = document.createElement("span");
      if (l.fixed) {
        s.className = "slot gap";
        row.appendChild(s);
        return;
      }
      s.className = "slot";
      if (play.filled[i]) {
        s.textContent = l.ch;
        s.classList.add(i === play.given ? "given" : "done");
      } else {
        if (ghost || (i === now && play.slotMisses > 0)) {
          s.textContent = l.ch;
          s.classList.add("ghost");
        }
        if (i === now) s.classList.add("now");
      }
      row.appendChild(s);
    });
    const typed = play.filled.filter(
      (f, i) => f && !play.letters[i].fixed,
    ).length;
    const total = play.letters.filter((l) => !l.fixed).length;
    row.setAttribute("role", "img");
    row.setAttribute("aria-label", t("slotAria", typed, total));

    let g = $("#btnGhost");
    if (!g) {
      g = document.createElement("button");
      g.type = "button";
      g.id = "btnGhost";
      g.className = "ghost-btn";
      g.textContent = "👻";
      g.addEventListener("click", () => {
        sfx("tap");
        ghost = !ghost;
        KidsStore.save(key("ghost"), ghost);
        renderSpell();
      });
    }
    g.setAttribute("aria-pressed", ghost);
    g.setAttribute("aria-label", ghost ? t("ghostOff") : t("ghostOn"));
    g.title = ghost ? t("ghostOff") : t("ghostOn");
    row.appendChild(g);
  }

  function renderTiles() {
    const el = $("#tiles");
    el.innerHTML = "";
    for (const tile of play.tiles) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tile" + (tile.used ? " used" : "");
      b.dataset.tid = tile.id;
      b.lang = play.lang;
      b.textContent = tile.ch;
      b.disabled = tile.used;
      b.setAttribute("aria-label", t("tileAria", tile.ch));
      b.addEventListener("click", () => tapTile(tile, b));
      el.appendChild(b);
    }
  }

  function tileBtn(tile) {
    return $(`#tiles .tile[data-tid="${tile.id}"]`);
  }
  // Wiggle an unused tile with exactly this letter.
  function hintTile(ch) {
    const tile = play.tiles.find((x) => !x.used && x.ch === ch);
    const b = tile && tileBtn(tile);
    if (b) restart(b, "hint");
  }

  function tapTile(tile, btn) {
    if (play.locked || tile.used) return;
    const i = nextSlot();
    if (i < 0) return;
    const expected = play.letters[i].ch;
    const res = L.checkLetter(expected, tile.ch);
    if (res === "right") {
      sfx("tap");
      tile.used = true;
      play.filled[i] = true;
      play.slotMisses = 0;
      btn.classList.add("used");
      btn.disabled = true;
      renderSpell();
      if (nextSlot() < 0) spellDone();
      return;
    }
    if (res === "close") {
      // a/á, n/ñ: a gentle nudge, not a mistake.
      sfx("tap");
      restart(btn, "shake");
      mPlay.setMood("think", 1600);
      mPlay.say(t("accent", expected), 2600);
      $("#feedback").textContent = t("accent", expected);
      hintTile(expected);
      return;
    }
    sfx("wrong");
    play.mistakes++;
    play.q.misses++;
    play.slotMisses++;
    restart(btn, "shake");
    $("#feedback").textContent = t("spellOops", expected);
    mPlay.setMood("think", 1400);
    renderSpell();
    if (play.slotMisses >= 2) hintTile(expected);
  }

  function spellDone() {
    play.locked = true;
    const q = play.q;
    const w = word(q);
    sfx("correct");
    $("#qCard").classList.add("good");
    const row = $("#spellRow");
    restart(row, "pop-sm");
    const qWord = $("#qWord");
    qWord.innerHTML = "";
    if (play.lang !== home()) {
      qWord.appendChild(wordEl(w, home(), "trans"));
      qWord.classList.add("show");
    }
    sayWord(w, play.lang);
    KidsFx.burstFrom(row, [treatIcon(), "⭐", "✨"], 12);
    const praise = pick(t("praise"));
    mPlay.setMood("happy", 1000);
    talk(mPlay);
    mPlay.say(praise, 1300);
    $("#feedback").textContent = praise;
    finishItem(q);
    play.timer = setTimeout(nextQuestion, 1600);
  }

  // ---------- memory ----------
  function startMemory(ids) {
    play.deck = L.memoryDeck(ids);
    $("#qPrompt").textContent = t("memoryQ");
    $("#qVisual").innerHTML = "";
    $("#qWord").innerHTML = "";
    $("#qWord").classList.remove("show");
    renderBoard();
    renderPairs();
  }

  function renderPairs() {
    const total = play.deck.length / 2;
    $("#pairsPill").textContent = `🃏 ${t("pairs", play.matched.size, total)}`;
    $("#pairsPill").setAttribute(
      "aria-label",
      t("pairsAria", play.matched.size, total),
    );
  }

  function renderBoard() {
    const el = $("#board");
    el.innerHTML = "";
    play.deck.forEach((c, i) => {
      const w = WORDS.get(c.id);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mcard";
      b.dataset.key = c.key;
      const up = play.open.includes(c.key) || play.matched.has(c.id);
      b.classList.toggle("up", up);
      b.classList.toggle("matched", play.matched.has(c.id));
      b.setAttribute(
        "aria-label",
        up ? L.textOf(w, play.lang) : t("cardAria", i + 1),
      );
      const back = document.createElement("span");
      back.className = "back";
      back.setAttribute("aria-hidden", "true");
      back.textContent = pack().emoji;
      const face = document.createElement("span");
      face.className = `face ${c.face}`;
      face.appendChild(c.face === "pic" ? pictureEl(w) : wordEl(w, play.lang));
      b.append(back, face);
      b.addEventListener("click", () => flip(c, b));
      el.appendChild(b);
    });
  }

  function flip(c, b) {
    if (play.locked || play.matched.has(c.id) || play.open.includes(c.key))
      return;
    if (play.open.length >= 2) return;
    const w = WORDS.get(c.id);
    sfx("tap");
    play.open.push(c.key);
    b.classList.add("up");
    b.setAttribute("aria-label", L.textOf(w, play.lang));
    if (c.face === "word") sayWord(w, play.lang);
    if (play.open.length < 2) return;
    play.tries++;
    const [k1, k2] = play.open;
    const id1 = k1.split(":")[0];
    const id2 = k2.split(":")[0];
    if (id1 === id2) {
      play.matched.add(id1);
      play.open = [];
      sfx("correct");
      sayWord(w, play.lang);
      document.querySelectorAll(`#board .mcard`).forEach((m) => {
        if (m.dataset.key.split(":")[0] === id1) {
          m.classList.add("matched");
          restart(m, "pop-sm");
        }
      });
      KidsFx.burstFrom(b, [treatIcon(), "⭐", "✨"], 8);
      mPlay.setMood("happy", 900);
      talk(mPlay);
      const line = t("match", L.textOf(w, play.lang));
      mPlay.say(line, 1400);
      $("#feedback").textContent = line;
      collect(id1);
      renderPairs();
      if (play.matched.size === play.deck.length / 2) {
        play.locked = true;
        play.timer = setTimeout(finishRound, 1300);
      }
    } else {
      play.mistakes++;
      sfx("wrong");
      const line = pick(t("notPair"));
      $("#feedback").textContent = line;
      mPlay.setMood("think", 1100);
      play.timer = setTimeout(() => {
        play.open = [];
        document
          .querySelectorAll("#board .mcard.up:not(.matched)")
          .forEach((m) => {
            m.classList.remove("up");
            m.setAttribute(
              "aria-label",
              t("cardAria", [...m.parentNode.children].indexOf(m) + 1),
            );
          });
      }, 1000);
    }
  }

  // ---------- keyboard ----------
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || current !== "play") return;
    const next = $("#btnNext");
    if (!next.hidden && (e.key === "Enter" || e.key === " ")) {
      if (document.activeElement !== next) {
        e.preventDefault();
        next.click();
      }
      return;
    }
    if (!play.q || play.locked) return;
    if (play.mode === "listen" || play.mode === "picture") {
      if (/^[1-4]$/.test(e.key)) {
        const btn = $("#choices").children[Number(e.key) - 1];
        if (btn) btn.click();
      }
    } else if (play.mode === "spell" && e.key.length === 1) {
      const ch = e.key.normalize("NFC").toLowerCase();
      // Prefer the exact letter; fall back to a tile with the same base (a → á hint).
      const tile =
        play.tiles.find((x) => !x.used && x.ch === ch) ||
        play.tiles.find(
          (x) => !x.used && L.baseLetter(x.ch) === L.baseLetter(ch),
        );
      if (tile) tapTile(tile, tileBtn(tile));
    }
  });

  $("#playBack").addEventListener("click", () => {
    sfx("tap");
    clearTimeout(play.timer);
    renderPack();
    show("pack");
  });
  $("#mascotPlay").addEventListener("click", () => poke(mPlay));

  // ---------- RESULTS ----------
  let last = null;

  function finishRound() {
    clearTimeout(play.timer);
    const p = pack();
    const stars = L.starsFor(play.mode, play.mistakes);
    best[p.id] = best[p.id] || {};
    if (stars > (best[p.id][play.mode] || 0)) {
      best[p.id][play.mode] = stars;
      saveStars();
    }
    last = {
      mode: play.mode,
      stars,
      firstTry: play.items.filter((f) => f.state === "good").length,
      total: play.items.length,
      tries: play.tries,
      stickers: play.newStickers.slice(),
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
      r.mode === "memory"
        ? t("resultMemory", r.tries)
        : r.mode === "spell"
          ? t("resultSpell", r.total)
          : t("resultQuiz", r.firstTry, r.total);
    const ns = $("#newStickers");
    ns.innerHTML = "";
    if (r.stickers.length) {
      const label = document.createElement("div");
      label.className = "ns-label";
      label.textContent = t("newStickers", r.stickers.length);
      const row = document.createElement("div");
      row.className = "ns-row";
      r.stickers.forEach((id, i) => {
        const w = WORDS.get(id);
        const s = document.createElement("span");
        s.className = "ns";
        s.style.animationDelay = `${1.6 + i * 0.12}s`;
        s.appendChild(pictureEl(w));
        s.title = L.textOf(w, target());
        row.appendChild(s);
      });
      ns.append(label, row);
    }
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
      mResult.setMood(r.stars >= 2 ? "happy" : "hop", r.stars >= 2 ? 0 : 500);
      setTimeout(() => $("#btnAgain").focus(), 60);
    } else {
      spans.forEach((s, i) => s.classList.add(i < r.stars ? "on" : "dim"));
    }
    mResult.say(t("results", cap(treatName(1)), treatName())[r.stars], 0);
  }

  $("#btnAgain").addEventListener("click", () =>
    startPlay(last ? last.mode : "listen"),
  );
  $("#btnToPack").addEventListener("click", () => {
    sfx("tap");
    renderPack();
    show("pack");
    mPack.setMood("idle");
  });

  // ---------- STICKER BOOK ----------
  function openBook() {
    sfx("tap");
    renderBook();
    show("book");
  }

  function renderBook() {
    const tl = target();
    const got = PACKS.reduce((s, p) => s + learnedCount(p.words), 0);
    $("#bookPill").textContent = `📒 ${got}/${ALL_COUNT}`;
    const body = $("#bookBody");
    body.innerHTML = "";
    for (const p of PACKS) {
      const sec = document.createElement("section");
      sec.className = "book-pack card";
      sec.style.setProperty("--c", p.color);
      const h = document.createElement("h3");
      h.innerHTML = `<span aria-hidden="true">${p.emoji}</span> <span class="bp-name"></span> <small></small>`;
      h.querySelector(".bp-name").textContent = KidsI18n.pickLang(p.name);
      h.querySelector("small").textContent = t(
        "bookPack",
        learnedCount(p.words),
        p.words.length,
      );
      const grid = document.createElement("div");
      grid.className = "stickers";
      for (const w of p.words) {
        const b = document.createElement("button");
        b.type = "button";
        const has = !!learned[w.id];
        b.className = "sticker" + (has ? "" : " locked");
        b.appendChild(pictureEl(w));
        if (has) {
          b.appendChild(wordEl(w, tl));
          if (tl !== home()) b.appendChild(wordEl(w, home(), "trans"));
          b.setAttribute("aria-label", L.textOf(w, tl));
        } else {
          const qm = document.createElement("span");
          qm.className = "word";
          qm.setAttribute("aria-hidden", "true");
          qm.textContent = "?";
          b.appendChild(qm);
          b.setAttribute("aria-label", t("bookLocked"));
        }
        b.addEventListener("click", () => {
          if (has) {
            sayWord(w, tl);
            restart(b, "pop-sm");
            sfx("tap");
          } else {
            sfx("tap");
            restart(b, "shake");
          }
        });
        grid.appendChild(b);
      }
      sec.append(h, grid);
      body.appendChild(sec);
    }
  }
  $("#bookBack").addEventListener("click", () => {
    sfx("tap");
    goHome();
  });

  // ---------- language & buddy changes ----------
  function renderStatic() {
    KidsI18n.apply(WORDS_I18N);
    document.title = t("docTitle", buddyName());
    $("#logoName").textContent = buddyName();
    renderSound();
  }

  function rerender() {
    renderStatic();
    if (current === "home") {
      renderHome();
      greet();
    } else if (current === "pack") {
      renderPack();
    } else if (current === "play") {
      renderPlayTitle();
      const lang = target();
      const changed = lang !== play.lang;
      play.lang = lang;
      if (play.mode === "memory") {
        $("#qPrompt").textContent = t("memoryQ");
        renderBoard();
        renderPairs();
      } else if (play.q && !play.locked) {
        // Same word, new language: redraw it (spell restarts this word).
        renderQuestion(changed);
      } else if (play.q) {
        $("#qPrompt").textContent = t(`${play.mode}Q`);
      }
      renderDots();
      $("#btnNext").textContent = t("next");
    } else if (current === "results") {
      renderResults(false);
    } else if (current === "book") {
      renderBook();
    }
  }
  KidsI18n.onChange(rerender);
  Mascots.onBuddyChange((id) => {
    buddyId = id;
    allMascots.forEach((m) => m.use(id));
    rerender();
    const m = { home: mHome, pack: mPack, play: mPlay, results: mResult }[
      current
    ];
    if (m) {
      m.sound();
      m.setMood("hop", 500);
    }
  });
  // Voices load asynchronously in some browsers; nothing to do but warm up.
  try {
    if (hasSpeech()) speechSynthesis.getVoices();
  } catch {}

  // ---------- boot ----------
  renderStatic();
  setPackColor();
  goHome();
})();
