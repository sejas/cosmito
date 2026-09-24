// UI for the coding game. Logic lives in engine.js (CodeEngine), levels in levels.js.
// Playable with any mascot ("buddy"); Pipo is the default. The buddy walks the
// grid and its treat is the goal.
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const t = KidsI18n.translator(CODE_I18N);
  const E = CodeEngine;
  const GAME = "code";
  const DEFAULT_BUDDY = "pipo";
  const LEVELS = CODE_LEVELS;
  const MAX_STARS = LEVELS.length * 3;
  const SPEEDS = { slow: 680, fast: 300 };
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pick = (arr) =>
    Array.isArray(arr) ? arr[Math.floor(Math.random() * arr.length)] : arr;
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

  // ---------- buddy & treat ----------
  let buddyId = Mascots.buddy(DEFAULT_BUDDY);
  const def = () => Mascots.get(buddyId);
  const buddyName = () => KidsI18n.pickLang(def().name);
  const treatName = (n = 2) => Mascots.treatName(def(), n);

  // ---------- persisted state ----------
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

  // ---------- mascots ----------
  const mHome = Mascots.create($("#mascotHome"), $("#bubbleHome"), buddyId);
  const mWalk = Mascots.create($("#walkerMascot"), $("#say"), buddyId);
  const mWin = Mascots.create($("#mascotWin"), $("#bubbleWin"), buddyId);
  const allMascots = [mHome, mWalk, mWin];

  function chomp(m, times = 3) {
    let i = 0;
    const step = () => {
      m.mouth(i % 2 ? 0 : 0.9);
      if (++i < times * 2) setTimeout(step, 110);
      else m.mouth(0);
    };
    step();
  }

  // ---------- sound & voice ----------
  document.addEventListener("pointerdown", () => KidsAudio.ensure(), true);
  document.addEventListener("keydown", () => KidsAudio.ensure(), true);
  const sfx = (name) => KidsAudio.sfx(name);
  const blip = (midi, dur = 0.09, type = "sine") => {
    const ctx = KidsAudio.ctx();
    if (ctx) KidsAudio.tone(midi, ctx.currentTime, dur, 0.1, type);
  };

  // The buddy reads its bubbles aloud (for pre-readers). Emoji are not spoken.
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
  function say(m, text, ms = 3200) {
    m.say(text, ms);
    if (m === mWalk) placeSay();
    speak(text);
  }
  const live = (text) => {
    $("#live").textContent = "";
    requestAnimationFrame(() => ($("#live").textContent = text));
  };

  // ---------- screens ----------
  function show(id) {
    hushVoice();
    document
      .querySelectorAll(".screen")
      .forEach((s) => s.classList.toggle("active", s.id === id));
    window.scrollTo(0, 0);
  }
  const onPlay = () => $("#play").classList.contains("active");

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

  // ---------- home / world map ----------
  function renderHome() {
    $("#logoName").textContent = buddyName();
    document.title = t("docTitle", buddyName());
    const total = E.totalStars(best);
    $("#totalStars").textContent = total;
    $("#maxStars").textContent = MAX_STARS;
    $("#totalFill").style.width = `${(100 * total) / MAX_STARS}%`;

    const next = LEVELS.findIndex((l, i) => isOpen(i) && !best[l.id]);
    const root = $("#worlds");
    root.innerHTML = "";
    CODE_WORLDS.forEach((w, wi) => {
      const levels = LEVELS.map((l, i) => ({ l, i })).filter(
        ({ l }) => l.world === wi,
      );
      const got = levels.reduce((s, { i }) => s + starsOf(i), 0);
      const card = document.createElement("section");
      card.className = "world card";
      card.style.setProperty("--wc", w.color);
      if (!isOpen(levels[0].i)) card.classList.add("closed");
      const head = document.createElement("div");
      head.className = "world-head";
      head.innerHTML = `<span class="world-icon" aria-hidden="true"></span><div class="world-text"><h2></h2><p></p></div><span class="world-stars"></span>`;
      head.querySelector(".world-icon").textContent = w.icon;
      head.querySelector("h2").textContent = t(`worlds.${w.id}`);
      head.querySelector("p").textContent = t(`worldAbout.${w.id}`);
      head.querySelector(".world-stars").textContent =
        `${got}/${levels.length * 3} ⭐`;
      card.appendChild(head);
      const row = document.createElement("div");
      row.className = "level-row";
      levels.forEach(({ l, i }) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "lvl";
        b.dataset.level = l.id;
        const open = isOpen(i);
        const s = starsOf(i);
        if (!open) {
          b.classList.add("locked");
          b.setAttribute("aria-label", t("levelLocked", l.id));
          b.innerHTML = '<span class="lvl-num" aria-hidden="true">🔒</span>';
        } else {
          b.setAttribute("aria-label", t("levelAria", l.id, s));
          b.innerHTML = `<span class="lvl-num" aria-hidden="true">${l.num}</span><span class="stars" aria-hidden="true">${[
            0, 1, 2,
          ]
            .map((k) => `<span class="${k < s ? "on" : ""}">★</span>`)
            .join("")}</span>`;
        }
        if (i === next) {
          b.classList.add("current");
          const tag = document.createElement("span");
          tag.className = "here";
          tag.setAttribute("aria-hidden", "true");
          tag.textContent = def().emoji;
          b.appendChild(tag);
        }
        b.addEventListener("click", () => {
          if (!open) {
            sfx("wrong");
            restart(b, "shake");
            say(mHome, t("lockedSay"), 2200);
            return;
          }
          sfx("tap");
          openLevel(i);
        });
        row.appendChild(b);
      });
      card.appendChild(row);
      root.appendChild(card);
    });
  }

  $("#mascotHome").addEventListener("click", () => {
    mHome.sound();
    chomp(mHome, 2);
    mHome.setMood("happy", 900);
    say(mHome, pick(t("poke")), 1800);
  });

  function goHome(message) {
    closeWin();
    abortRun();
    show("home");
    renderHome();
    mHome.setMood("idle");
    setTimeout(
      () =>
        say(mHome, message || pick(t("hello", buddyName(), treatName())), 4000),
      300,
    );
  }

  // ---------- play state ----------
  let li = 0;
  let L = null;
  let world = null;
  let solution = [];
  let prog = [];
  let cursor = { parent: "", index: 0 };
  let undoStack = [];
  let fails = 0;
  let hintOn = false;
  let failPath = null;
  let runState = null;
  let resetTimer = 0;
  let cell = 64;
  let walkerPos = { x: 0, y: 0 };

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
    show("play");
    renderTitle();
    buildBoard();
    resetWalker();
    renderPalette();
    renderProgram();
    renderControls();
    mWalk.setMood("idle");
    mWalk.hush();
    const tip = L.tip ? t(`tips.${L.tip}`, treatName(1)) : null;
    setTimeout(() => {
      if (L === LEVELS[i] && onPlay()) {
        mWalk.setMood("hop", 700);
        say(
          mWalk,
          tip || pick(t("hello", buddyName(), treatName())),
          tip ? 5000 : 3000,
        );
      }
    }, 450);
  }

  function renderTitle() {
    const w = CODE_WORLDS[L.world];
    const s = starsOf(li);
    $("#playTitle").innerHTML = "";
    const name = document.createElement("span");
    name.textContent = `${w.icon} ${t("levelTitle", t(`worlds.${w.id}`), L.num)}`;
    const st = document.createElement("span");
    st.className = "stars";
    st.setAttribute("aria-label", t("levelAria", L.id, s));
    st.innerHTML = [0, 1, 2]
      .map(
        (k) => `<span class="${k < s ? "on" : ""}" aria-hidden="true">★</span>`,
      )
      .join("");
    $("#playTitle").append(name, st);
    $("#play").style.setProperty("--wc", w.color);
    document.title = t("docTitle", buddyName());
  }

  // ---------- board ----------
  const TILE_CLASS = {
    ".": "grass",
    "#": "rock",
    "^": "tree",
    "~": "water",
    y: "pad pad-y",
    p: "pad pad-p",
  };

  function buildBoard() {
    const board = $("#board");
    board.innerHTML = "";
    board.style.setProperty("--cols", world.w);
    board.style.setProperty("--rows", world.h);
    board.setAttribute("aria-label", t("board"));
    for (let y = 0; y < world.h; y++) {
      for (let x = 0; x < world.w; x++) {
        const ch = world.tiles[y][x];
        const c = document.createElement("div");
        c.className = `cell ${TILE_CLASS[ch]}${(x + y) % 2 ? " alt" : ""}`;
        c.dataset.x = x;
        c.dataset.y = y;
        if (ch === "#") c.innerHTML = '<span class="thing">🪨</span>';
        if (ch === "^") c.innerHTML = '<span class="thing">🌳</span>';
        if (ch === "y" || ch === "p")
          c.innerHTML = '<span class="pad-glow"></span>';
        board.appendChild(c);
      }
    }
    world.gems.forEach((g, i) => {
      const gem = document.createElement("span");
      gem.className = "gem";
      gem.dataset.gem = i;
      gem.textContent = "💎";
      cellAt(g.x, g.y).appendChild(gem);
    });
    const home = cellAt(world.start.x, world.start.y);
    home.classList.add("start");
    const goal = cellAt(world.treat.x, world.treat.y);
    goal.classList.add("goal");
    goal.appendChild(Mascots.treatEl(def(), "treat-icon"));
    sizeBoard();
  }
  const cellAt = (x, y) => $(`#board .cell[data-x="${x}"][data-y="${y}"]`);

  function sizeBoard() {
    if (!world) return;
    const wrap = $("#boardWrap");
    const wide = innerWidth >= 900;
    const availW = wrap.clientWidth - 8;
    const availH = wide
      ? innerHeight - 230
      : innerHeight * (innerWidth < 600 ? 0.36 : 0.4);
    cell = Math.floor(
      Math.max(
        34,
        Math.min(112, availW / world.w, availH / Math.max(world.h, 2)),
      ),
    );
    wrap.style.setProperty("--cell", `${cell}px`);
    requestAnimationFrame(() => {
      const top = innerWidth < 900 ? $(".board-card").offsetHeight : 0;
      document.documentElement.style.setProperty("--sticky-top", `${top}px`);
    });
    placeWalker(walkerPos.x, walkerPos.y, 0);
    placeSay();
  }
  addEventListener("resize", sizeBoard);

  const boardOffset = () => {
    const b = $("#board");
    return { x: b.offsetLeft, y: b.offsetTop };
  };

  function placeWalker(x, y, ms) {
    walkerPos = { x, y };
    const w = $("#walker");
    const o = boardOffset();
    w.style.transitionDuration = `${reduced() ? 0 : ms}ms`;
    w.style.transform = `translate(${o.x + x * cell}px, ${o.y + y * cell}px)`;
  }

  // Keep the speech bubble next to the buddy and inside the board.
  function placeSay() {
    const s = $("#say");
    const wrap = $("#boardWrap");
    if (!s.classList.contains("show")) return;
    const o = boardOffset();
    const cx = o.x + (walkerPos.x + 0.5) * cell;
    const top = o.y + walkerPos.y * cell;
    const w = s.offsetWidth;
    const h = s.offsetHeight;
    const left = Math.max(4, Math.min(wrap.clientWidth - w - 4, cx - w / 2));
    const above =
      top - h - 12 >= -8 || top + cell + h + 12 > wrap.clientHeight + 8;
    s.classList.toggle("below", !above);
    s.style.left = `${left}px`;
    s.style.top = `${above ? top - h - 12 : top + cell + 12}px`;
    s.style.setProperty(
      "--tail",
      `${Math.max(16, Math.min(w - 16, cx - left))}px`,
    );
  }

  // One animation at a time on the buddy: appear, stepping, bump or splash.
  function animBody(cls) {
    const body = $("#walkerBody");
    body.className = "walker-body";
    void body.offsetWidth;
    body.classList.add(cls);
  }

  function resetWalker() {
    clearTimeout(resetTimer);
    resetTimer = 0;
    const body = $("#walkerBody");
    body.className = "walker-body";
    $("#walkerMascot").classList.remove("face-left");
    placeWalker(world.start.x, world.start.y, 0);
    document
      .querySelectorAll("#board .gem")
      .forEach((g) => g.classList.remove("taken"));
    document
      .querySelectorAll("#board .cell")
      .forEach((c) => c.classList.remove("check-yes", "check-no", "missing", "eaten"));
    animBody("appear");
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

  // Face of a block (arrow, loop, pad).
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

  const currentHint = () => (hintOn && L ? E.hint(prog, solution) : null);
  const atPos = (a, parent, index) =>
    a && a.parent === parent && a.index === index;

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
  }

  // The element to highlight for a path: a block, or the head of a container.
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

  function blockEl(b, path, h) {
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
    renderList(body, b.body, path, h);
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
    if (runState) return;
    const h = currentHint();
    const hinted = h && h.type === "add" && sameKind(h.block, b);
    const where = hinted ? { parent: h.parent, index: h.index } : cursor;
    const block = hinted ? h.block : b;
    const r = E.insert(prog, where, block);
    if (r.full) {
      sfx("wrong");
      restart($("#program"), "shake");
      say(mWalk, t("full"), 2200);
      return;
    }
    edit(() => {
      prog = r.prog;
      cursor = r.cursor;
    });
    blip(block.t === "move" ? { U: 79, R: 76, D: 72, L: 74 }[block.d] : 84);
    restart(elAt(r.path), "pop");
    if (L.tutor || hintOn) nudgeWhenDone();
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

  // When the hinted program is complete, point at ▶.
  function nudgeWhenDone() {
    if (hintOn && !E.hint(prog, solution)) {
      $("#btnRun").classList.add("hint-pulse");
      if (!L.tutor) say(mWalk, t("hintDone"), 2400);
    }
  }

  // ---------- controls ----------
  function renderControls() {
    const running = !!runState;
    const n = E.count(prog);
    const s = n ? E.stars(n, L.optimal) : 0;
    const meter = $("#meter");
    meter.innerHTML = `<span class="m-count"><span aria-hidden="true">🧩</span> ${n}</span><span class="stars" aria-hidden="true">${[
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
    $("#btnRun").setAttribute("aria-label", t(running && !paused ? "pause" : "run"));
    $("#btnRun").classList.toggle(
      "hint-pulse",
      hintOn && !running && prog.length > 0 && !E.hint(prog, solution),
    );
    $("#codeCard").classList.toggle("is-running", running);
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
    say(mWalk, h ? t("hintSay") : t("hintDone"), 2600);
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
  $("#btnBack").addEventListener("click", () => goHome());

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
      .forEach((el) => {
        el.classList.remove("now", "now-box", "pass", "nopass");
      });
    document.querySelectorAll("#program .box.blk-repeat").forEach((box) => {
      const b = E.blockAt(prog, box.dataset.path);
      const c = box.querySelector(".count");
      if (b && c) c.textContent = `×${b.n}`;
    });
  }

  // ▶ runs (or resumes a paused step-by-step run, or pauses a running one).
  // 👣 runs one block at a time.
  async function startRun(stepMode) {
    await KidsAudio.ensure();
    if (runState) {
      if (stepMode || !runState.stepMode) {
        runState.stepMode = true;
      } else {
        runState.stepMode = false;
      }
      const go = runState.advance;
      runState.advance = null;
      renderControls();
      go?.();
      return;
    }
    const res = E.run(world, prog);
    if (res.reason === "empty") {
      sfx("wrong");
      say(mWalk, t("fail.empty"), 2400);
      live(t("failAria.empty"));
      document
        .querySelectorAll("#palette .blk")
        .forEach((b) => restart(b, "pop"));
      return;
    }
    hushVoice();
    mWalk.hush();
    failPath = null;
    resetWalker();
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
      await animateStep(res.trace[i]);
    }
    if (run.abort) return;
    runState = null;
    clearNow();
    if (res.result === "win") onWin();
    else onFail(res);
    renderControls();
  }

  async function animateStep(step) {
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
      blip(72 + step.iter * 2, 0.07);
      await wait(ms * 0.4);
      return;
    }
    if (step.kind === "check") {
      const head = box?.querySelector(".box-head");
      head?.classList.remove("pass", "nopass");
      head?.classList.add("now", step.pass ? "pass" : "nopass");
      const c = cellAt(walkerPos.x, walkerPos.y);
      if (c) restart(c, step.pass ? "check-yes" : "check-no");
      blip(step.pass ? 88 : 60, 0.1, step.pass ? "sine" : "triangle");
      await wait(ms * 0.55);
      head?.classList.remove("now");
      return;
    }
    // move
    const el = $(`#program .blk[data-path="${step.path}"]`);
    el?.classList.add("now");
    el?.scrollIntoView({ block: "nearest" });
    const mascotEl = $("#walkerMascot");
    if (step.d === "L") mascotEl.classList.add("face-left");
    if (step.d === "R") mascotEl.classList.remove("face-left");
    const body = $("#walkerBody");
    if (step.bump) {
      const [dx, dy] = E.DIRS[step.d];
      body.style.setProperty("--bx", `${dx * cell * 0.35}px`);
      body.style.setProperty("--by", `${dy * cell * 0.35}px`);
      animBody("bump");
      sfx("wrong");
      mWalk.setMood("think");
      await wait(Math.max(ms, 500));
      return;
    }
    placeWalker(step.x, step.y, ms * 0.85);
    animBody("stepping");
    blip({ U: 79, R: 76, D: 72, L: 74 }[step.d], 0.08);
    await wait(ms);
    if (step.gem != null) {
      const g = $(`#board .gem[data-gem="${step.gem}"]`);
      if (g) {
        g.classList.add("taken");
        KidsFx.burstFrom(g, ["💎", "✨"], 8);
      }
      sfx("star");
    }
    if (step.splash) {
      animBody("splash");
      KidsFx.burstFrom(cellAt(step.x, step.y), ["💦", "💧"], 10);
      sfx("wrong");
      await wait(Math.max(ms, 600));
    }
  }

  function onFail(res) {
    fails++;
    failPath = res.failPath;
    mWalk.setMood(res.reason === "splash" ? "wow" : "think", 1800);
    const text =
      res.reason === "end"
        ? pick(t("fail.end", treatName(1)))
        : pick(t(`fail.${res.reason}`));
    if (res.reason === "end") sfx("wrong");
    if (res.reason === "gems") {
      sfx("wrong");
      document
        .querySelectorAll("#board .gem:not(.taken)")
        .forEach((g) => restart(g.parentElement, "missing"));
    }
    say(mWalk, text, 3000);
    live(t(`failAria.${res.reason}`));
    if (fails >= 2 && !hintOn) {
      hintOn = true;
      setTimeout(() => {
        if (!runState && onPlay()) say(mWalk, t("hintSay"), 2600);
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
    mWalk.setMood("happy", 1400);
    chomp(mWalk, 4);
    const goal = cellAt(world.treat.x, world.treat.y);
    goal.classList.add("eaten");
    KidsFx.burstFrom(goal, [Mascots.treatOf(def()).icon, "⭐", "✨"], 14);
    sfx("fanfare");
    setTimeout(() => showWin(s, blocks, firstWin), reduced() ? 300 : 1100);
  }

  // ---------- win dialog ----------
  let lastFocus = null;
  function showWin(s, blocks, firstWin) {
    if (!onPlay()) return;
    lastFocus = document.activeElement;
    const win = $("#win");
    win.hidden = false;
    KidsFx.confetti();
    mWin.use(buddyId);
    mWin.setMood("happy", 2500);
    say(mWin, pick(t("win", treatName(1))), 3000);
    const stars = [...$("#bigStars").children];
    stars.forEach((el) => el.classList.remove("on"));
    $("#bigStars").setAttribute("aria-label", t("winAria", s, blocks));
    stars.slice(0, s).forEach((el, k) =>
      setTimeout(
        () => {
          el.classList.add("on");
          sfx("star");
        },
        350 + k * 330,
      ),
    );
    const line = $("#winLine");
    line.textContent = "";
    const count = document.createElement("span");
    count.className = "win-count";
    count.textContent = `🧩 ${t("winBlocks", blocks)}`;
    line.appendChild(count);
    if (s < 3) {
      const more = document.createElement("span");
      more.className = "win-better";
      more.textContent = t("winBetter", L.optimal);
      line.appendChild(more);
    }
    live(t("winAria", s, blocks));
    const last = li === LEVELS.length - 1;
    $("#btnNext").hidden = last;
    renderTitle();
    ($("#btnNext").hidden ? $("#btnMap") : $("#btnNext")).focus();
    win.dataset.newWorld =
      firstWin && !last && LEVELS[li + 1].world !== L.world ? "1" : "";
    win.dataset.allDone =
      firstWin && E.totalStars(best) > 0 && LEVELS.every((l) => best[l.id])
        ? "1"
        : "";
  }

  function closeWin() {
    const win = $("#win");
    if (win.hidden) return;
    win.hidden = true;
    mWin.hush();
  }

  $("#btnReplay").addEventListener("click", () => {
    closeWin();
    sfx("tap");
    resetWalker();
    renderProgram();
    $("#btnRun").focus();
  });
  $("#btnMap").addEventListener("click", () => {
    const done = $("#win").dataset.allDone;
    sfx("tap");
    goHome(done ? t("allDone", buddyName()) : null);
  });
  $("#btnNext").addEventListener("click", () => {
    sfx("tap");
    if ($("#win").dataset.newWorld) {
      goHome(t("worldDone"));
      return;
    }
    openLevel(Math.min(li + 1, LEVELS.length - 1));
  });

  // ---------- keyboard ----------
  // Arrow keys add arrow blocks; Backspace undoes; Escape closes the dialog.
  const KEYS = {
    ArrowUp: "U",
    ArrowDown: "D",
    ArrowLeft: "L",
    ArrowRight: "R",
  };
  document.addEventListener("keydown", (e) => {
    if (!$("#win").hidden) {
      if (e.key === "Escape") $("#btnReplay").click();
      if (e.key === "Tab") {
        // Keep focus inside the dialog.
        const f = [...$("#win").querySelectorAll("button:not([hidden])")];
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) {
          f[f.length - 1].focus();
          e.preventDefault();
        } else if (!e.shiftKey && i === f.length - 1) {
          f[0].focus();
          e.preventDefault();
        }
      }
      return;
    }
    if (!onPlay() || e.altKey || e.ctrlKey || e.metaKey) return;
    const d = KEYS[e.key];
    if (d && L.palette.includes(d)) {
      e.preventDefault();
      addBlock({ t: "move", d });
    } else if (e.key === "Backspace") {
      e.preventDefault();
      undo();
    }
  });

  // ---------- language & buddy ----------
  function renderAll() {
    KidsI18n.apply(CODE_I18N);
    renderSound();
    renderHome();
    if (L) {
      renderTitle();
      renderProgram();
      $("#board").setAttribute("aria-label", t("board"));
    }
  }
  KidsI18n.onChange(renderAll);
  Mascots.onBuddyChange((id) => {
    buddyId = id;
    allMascots.forEach((m) => m.use(id));
    renderHome();
    if (L) {
      const goal = cellAt(world.treat.x, world.treat.y);
      goal.querySelector(".treat-icon")?.remove();
      goal.appendChild(Mascots.treatEl(def(), "treat-icon"));
      renderTitle();
    }
    mHome.setMood("hop", 700);
    mHome.sound();
    say(
      mHome,
      pick(
        KidsI18n.pickLang(def().greeting) ||
          t("hello", buddyName(), treatName()),
      ),
      3000,
    );
  });

  // ---------- start ----------
  renderAll();
  setTimeout(
    () => say(mHome, pick(t("hello", buddyName(), treatName())), 4000),
    500,
  );

  // Debug/test hook: ?level=2-3 opens a level directly.
  const want = new URLSearchParams(location.search).get("level");
  const wi = LEVELS.findIndex((l) => l.id === want);
  if (wi >= 0) openLevel(wi);
})();
