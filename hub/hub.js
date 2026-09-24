(() => {
  const $ = (s) => document.querySelector(s);

  const DICT = {
    en: {
      title: "Pipo & Friends",
      meet: "Meet the friends",
      play: "What shall we play?",
      free: "Free & open-source games for kids · Made with 💛",
      soundOn: "🔊 Sound",
      soundOff: "🔇 Muted",
      soon: "More games coming soon!",
      soonAbout: "Want to make one? It's open source! 🛠️",
      ranks: [
        "New Explorer 🧭",
        "Curious Cub 🐾",
        "Bright Spark ✨",
        "Super Learner 🚀",
        "Legend 👑",
      ],
      next: (n, rank) => `${n} more ⭐ to become ${rank}`,
      maxed: "You collected every star! 🏆",
      welcome: "Hi friend! What shall we play today? 🎈",
      chosen: "Yay! Let's play together! 🎉",
      myBuddy: "⭐ My buddy",
      pickMe: "Pick me!",
    },
    es: {
      title: "Pipo y sus amigos",
      meet: "Conoce a los amigos",
      play: "¿A qué jugamos?",
      free: "Juegos gratis y de código abierto para peques · Hecho con 💛",
      soundOn: "🔊 Sonido",
      soundOff: "🔇 Silencio",
      soon: "¡Pronto habrá más juegos!",
      soonAbout: "¿Quieres crear uno? ¡Es código abierto! 🛠️",
      ranks: [
        "Explorador novato 🧭",
        "Cachorro curioso 🐾",
        "Chispa brillante ✨",
        "Súper aprendiz 🚀",
        "Leyenda 👑",
      ],
      next: (n, rank) => `${n} ⭐ más para ser ${rank}`,
      maxed: "¡Tienes todas las estrellas! 🏆",
      welcome: "¡Hola! ¿A qué jugamos hoy? 🎈",
      chosen: "¡Bien! ¡Vamos a jugar juntos! 🎉",
      myBuddy: "⭐ Mi amigo",
      pickMe: "¡Elígeme!",
    },
  };
  const t = KidsI18n.translator(DICT);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Build one mascot per registered friend.
  const friends = Mascots.list().map((def, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "friend";
    btn.style.setProperty("--c", def.color);
    const wrap = document.createElement("div");
    wrap.className = "friend-mascot";
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    wrap.appendChild(bubble);
    const name = document.createElement("div");
    name.className = "friend-name";
    const about = document.createElement("div");
    about.className = "friend-about";
    const badge = document.createElement("div");
    badge.className = "friend-badge";
    btn.append(badge, wrap, name, about);
    $("#friends").appendChild(btn);
    const mascot = Mascots.create(wrap, bubble, def.id);
    btn.addEventListener("click", async () => {
      await KidsAudio.ensure();
      // Tapping a friend makes them your buddy in every game.
      Mascots.setBuddy(def.id);
      mascot.sound();
      mascot.say(t("chosen"), 2400);
      mascot.setMood("happy", 1400);
    });
    return { def, mascot, btn, name, about, badge, index: i };
  });

  // Catalogue texts are strings or functions of (buddy name, treats).
  function textOf(field, ...args) {
    const v = KidsI18n.pickLang(field);
    return typeof v === "function" ? v(...args) : v;
  }

  function renderFriends() {
    // Only an explicit choice is marked; until then each game uses its own mascot.
    const chosen = KidsStore.load("buddy", null);
    for (const f of friends) {
      f.name.textContent = KidsI18n.pickLang(f.def.name);
      f.about.textContent = KidsI18n.pickLang(f.def.about);
      f.btn.classList.toggle("chosen", f.def.id === chosen);
      f.btn.setAttribute("aria-pressed", String(f.def.id === chosen));
      f.badge.textContent = f.def.id === chosen ? t("myBuddy") : t("pickMe");
    }
  }

  function renderGames() {
    const progress = KidsStore.progress();
    const list = $("#games");
    list.innerHTML = "";
    for (const game of GAMES) {
      const stars = progress[game.id]?.stars || 0;
      const a = document.createElement("a");
      a.className = "game-card card";
      a.href = game.href;
      a.style.setProperty("--c", game.color);
      const buddy = Mascots.get(Mascots.buddy(game.mascot));
      const buddyName = KidsI18n.pickLang(buddy.name);
      const pct = Math.round((stars / game.maxStars) * 100);
      a.innerHTML = `
        <div class="game-top">
          <span class="game-emoji"></span>
          <span class="game-mascot"></span>
        </div>
        <div class="game-body">
          <div class="game-title"></div>
          <div class="game-about"></div>
          <div class="game-skills"></div>
          <div class="game-progress"><div style="width:${pct}%"></div></div>
          <div class="game-stars">⭐ ${stars} / ${game.maxStars}</div>
        </div>`;
      a.querySelector(".game-emoji").textContent = game.emoji;
      a.querySelector(".game-mascot").textContent = buddy.emoji;
      a.querySelector(".game-title").textContent = textOf(game.title, buddyName);
      a.querySelector(".game-about").textContent = textOf(
        game.about,
        buddyName,
        Mascots.treatName(buddy),
      );
      a.querySelector(".game-skills").textContent = KidsI18n.pickLang(
        game.skills,
      );
      a.addEventListener("click", () => KidsAudio.sfx("tap"));
      list.appendChild(a);
    }
    const soon = document.createElement("div");
    soon.className = "game-card card soon";
    soon.innerHTML = `<div class="game-top"><span class="game-emoji">🎁</span></div>
      <div class="game-body"><div class="game-title"></div><div class="game-about"></div></div>`;
    soon.querySelector(".game-title").textContent = t("soon");
    soon.querySelector(".game-about").textContent = t("soonAbout");
    list.appendChild(soon);
  }

  function renderTrophy() {
    const have = KidsStore.totalStars();
    const max = GAMES.reduce((sum, g) => sum + g.maxStars, 0);
    const ranks = t("ranks");
    const step = max / (ranks.length - 1);
    const rank = Math.min(ranks.length - 1, Math.floor(have / step));
    $("#rank").textContent = ranks[rank];
    $("#stars").textContent = have;
    $("#maxStars").textContent = max;
    $("#bar").style.width = `${(have / max) * 100}%`;
    $("#next").textContent =
      rank < ranks.length - 1
        ? t("next", Math.ceil(step * (rank + 1)) - have, ranks[rank + 1])
        : t("maxed");
  }

  function renderSound() {
    $("#btnSound").textContent = KidsAudio.isMuted()
      ? t("soundOff")
      : t("soundOn");
  }

  function render() {
    KidsI18n.apply(DICT);
    document.title = t("title");
    renderFriends();
    renderGames();
    renderTrophy();
    renderSound();
  }

  KidsI18n.mountPicker($("#btnLang"));
  KidsI18n.onChange(render);
  Mascots.onBuddyChange(render);
  $("#btnSound").addEventListener("click", async () => {
    await KidsAudio.ensure();
    KidsAudio.setMuted(!KidsAudio.isMuted());
    KidsAudio.sfx("tap");
    renderSound();
  });

  render();
  // Friends take turns saying hello.
  friends.forEach((f, i) =>
    setTimeout(
      () => {
        f.mascot.say(
          i === 0 ? t("welcome") : pick(KidsI18n.pickLang(f.def.greeting)),
          3200,
        );
        f.mascot.setMood("hop", 400);
      },
      500 + i * 1800,
    ),
  );
})();
