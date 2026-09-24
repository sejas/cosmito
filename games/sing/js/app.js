(() => {
  const $ = (s) => document.querySelector(s);
  // ?fake=1 replaces the microphone with a simulated singer (for demos and testing).
  const FAKE = new URLSearchParams(location.search).has("fake");

  const TOLERANCE = 1.0; // semitones — generous for kids
  const GOOD_RATIO = 0.4; // share of a note that must be on pitch to earn its star
  const TOTAL_STARS = SONGS.length * 3;

  const PC_COLORS = {
    0: "#ff6b6b",
    2: "#ffa94d",
    4: "#ffd43b",
    5: "#51cf66",
    7: "#4dabf7",
    9: "#9775fa",
    11: "#f783ac",
  };
  const NAMES = {
    sol: [
      "Do",
      "Do#",
      "Re",
      "Re#",
      "Mi",
      "Fa",
      "Fa#",
      "Sol",
      "Sol#",
      "La",
      "La#",
      "Si",
    ],
    abc: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
  };

  const I18N = {
    en: {
      logo1: "Sing",
      logo2: "with",
      pickSong: "Pick a song!",
      again: "Sing again",
      songs: "Songs",
      allGames: "All games",
      speed: { slow: "🐢 Slow", normal: "🐇 Normal" },
      guide: { on: (name) => `🔊 ${name} sings too`, off: "🔇 I sing alone" },
      names: { sol: "🎼 Do Re Mi", abc: "🎼 C D E" },
      levels: ["", "Easy", "Medium", "Tricky"],
      hello: (name) => [
        `Hi! I'm ${name}! Let's sing together! 🎶`,
        "Pick a song and sing with me!",
        "Sing the colored notes. I'll help you! 💛",
        "Ready to sing? 🎤",
      ],
      poke: [
        "Hee hee, that tickles! 😆",
        "La la laaa! 🎶",
        "Let's sing! 🎤",
      ],
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
      logo1: "Canta",
      logo2: "con",
      pickSong: "¡Elige una canción!",
      again: "Otra vez",
      songs: "Canciones",
      allGames: "Todos los juegos",
      speed: { slow: "🐢 Despacio", normal: "🐇 Normal" },
      guide: { on: (name) => `🔊 ${name} canta también`, off: "🔇 Canto yo solo" },
      names: { sol: "🎼 Do Re Mi", abc: "🎼 C D E" },
      levels: ["", "Fácil", "Media", "Difícil"],
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
  const RANK_AT = [0, 3, 6, 10, 15];

  // Sing-specific settings; language is global (KidsI18n).
  const settings = Object.assign(
    { speed: "normal", guide: "on", names: "sol" },
    KidsStore.load("sing.settings", {}),
  );
  const best = KidsStore.load("sing.best", {});
  const T = () => I18N[KidsI18n.get()] || I18N.en;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const buddyHome = Mascots.create($("#mascotHome"), $("#bubbleHome"), Mascots.buddy("pipo"));
  const buddyGame = Mascots.create($("#mascotGame"), $("#bubbleGame"), Mascots.buddy("pipo"));
  const buddyResult = Mascots.create($("#mascotResult"), $("#bubbleResult"), Mascots.buddy("pipo"));

  // Any mascot can be the singing buddy; Pipo is this game's default.
  const buddies = [buddyHome, buddyGame, buddyResult];
  const buddyName = () => KidsI18n.pickLang(buddyHome.def.name);
  const hello = () => T().hello(buddyName());

  // ---------- audio ----------
  let actx = null;
  let analyser = null;
  let micStream = null;
  let timeBuf = null;
  let scheduled = [];

  async function ensureAudio() {
    actx = await KidsAudio.ensure();
  }

  async function ensureMic() {
    if (FAKE) return "ok";
    if (analyser) return "ok";
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
    micStream?.getTracks().forEach((t) => t.stop());
    micStream = null;
    analyser = null;
  }

  // Guide melody and countdown notes are tracked so leaving a song silences them.
  function tone(midi, when, dur, vol, type) {
    const osc = KidsAudio.tone(midi, when, dur, vol, type);
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

  // ---------- screens ----------
  function show(id) {
    document
      .querySelectorAll(".screen")
      .forEach((s) => s.classList.toggle("active", s.id === id));
  }

  function noteName(midi) {
    return NAMES[settings.names][((midi % 12) + 12) % 12];
  }

  const applyI18n = () => KidsI18n.apply(I18N);

  function totalStars() {
    return SONGS.reduce((sum, s) => sum + (best[s.id] || 0), 0);
  }

  // Lets the hub show this game's stars.
  const reportProgress = () => KidsStore.setProgress("sing", totalStars(), TOTAL_STARS);

  function renderHome() {
    const t = T();
    applyI18n();
    $("#logoName").textContent = buddyName();
    $("#progressBuddy").textContent = buddyHome.def.emoji;
    document.title = `${t.logo1} ${t.logo2} ${buddyName()}`;
    $("#btnSpeed").textContent = t.speed[settings.speed];
    $("#btnGuide").textContent =
      settings.guide === "on" ? t.guide.on(buddyName()) : t.guide.off;
    $("#btnNames").textContent = t.names[settings.names];

    const list = $("#songList");
    list.innerHTML = "";
    SONGS.forEach((song) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "song-card";
      b.style.setProperty("--c", song.color);
      const stars = best[song.id] || 0;
      b.innerHTML = `
        <div class="song-emoji">${song.emoji}</div>
        <div class="song-name">${KidsI18n.pickLang(song.title)}</div>
        <div class="song-level">${"🎵".repeat(song.level)} ${t.levels[song.level]}</div>
        <div class="song-best">${[1, 2, 3].map((i) => `<span class="${i <= stars ? "on" : ""}">★</span>`).join("")}</div>`;
      b.addEventListener("click", () => startSong(song));
      list.appendChild(b);
    });

    const have = totalStars();
    let rank = 0;
    RANK_AT.forEach((at, i) => {
      if (have >= at) rank = i;
    });
    $("#rankTitle").textContent = t.ranks[rank];
    $("#rankStars").textContent = have;
    $("#rankMax").textContent = TOTAL_STARS;
    $("#rankFill").style.width = `${(have / TOTAL_STARS) * 100}%`;
    $("#rankNext").textContent =
      rank < RANK_AT.length - 1
        ? t.nextRank(RANK_AT[rank + 1] - have, t.ranks[rank + 1])
        : t.maxRank;
  }

  let greetTimer = 0;
  function goHome() {
    stopSong();
    releaseMic();
    show("home");
    renderHome();
    buddyHome.setMood("idle");
    const greet = (i) => {
      buddyHome.say(i === 0 ? hello()[0] : pick(hello()), 4200);
      buddyHome.setMood("hop", 400);
      clearTimeout(greetTimer);
      greetTimer = setTimeout(() => greet(i + 1), 9000);
    };
    greet(0);
  }

  function toggle(key, a, b) {
    settings[key] = settings[key] === a ? b : a;
    KidsStore.save("sing.settings", settings);
    renderHome();
  }
  $("#btnSpeed").addEventListener("click", () =>
    toggle("speed", "normal", "slow"),
  );
  $("#btnGuide").addEventListener("click", () => toggle("guide", "on", "off"));
  $("#btnNames").addEventListener("click", () => toggle("names", "sol", "abc"));
  KidsI18n.mountPicker($("#btnLang"));
  KidsI18n.onChange(() => {
    if (!$("#home").classList.contains("active")) return;
    renderHome();
    buddyHome.say(hello()[0], 3000);
  });
  Mascots.mountPicker($("#btnBuddy"), "pipo");
  Mascots.onBuddyChange((id) => {
    buddies.forEach((m) => m.use(id));
    if (!$("#home").classList.contains("active")) return;
    renderHome();
    buddyHome.sound();
    buddyHome.say(hello()[0], 3000);
    buddyHome.setMood("happy", 1200);
  });
  $("#mascotHome").addEventListener("click", async () => {
    await ensureAudio();
    buddyHome.sound();
    buddyHome.say(
      pick([...T().poke, ...KidsI18n.pickLang(buddyHome.def.greeting)]),
      2000,
    );
    buddyHome.setMood("happy", 1200);
  });

  // ---------- game ----------
  const canvas = $("#canvas");
  const g = canvas.getContext("2d");
  let W = 0;
  let H = 0;
  let game = null;
  let raf = 0;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", () => game && resize());

  async function startSong(song) {
    await ensureAudio();
    stopSong();
    show("game");
    resize();

    const spb = 60 / (song.bpm * (settings.speed === "slow" ? 0.75 : 1));
    const notes = song.notes.map((n, i) => ({
      ...n,
      i,
      start: n.startBeat * spb,
      end: (n.startBeat + n.beats) * spb,
      dur: n.beats * spb,
      hit: 0,
      done: false,
      good: false,
    }));
    const midis = notes.map((n) => n.midi);
    let minM = Math.min(...midis) - 2;
    let maxM = Math.max(...midis) + 2;
    while (maxM - minM < 11) {
      minM--;
      maxM++;
    }

    game = {
      song,
      spb,
      notes,
      minM,
      maxM,
      duration: song.totalBeats * spb,
      startAt: 0,
      lastT: -99,
      score: 0,
      streak: 0,
      anyVoice: false,
      recent: [],
      unvoiced: 99,
      voice: null,
      beak: 0,
      onTime: 0,
      trail: [],
      particles: [],
      offAcc: 0,
      offSign: 0,
      silentAcc: 0,
      lastHint: 0,
      phrase: -1,
      countdown: null,
      micOk: true,
    };

    $("#gameTitle").textContent =
      `${song.emoji} ${KidsI18n.pickLang(song.title)}`;
    $("#scoreNow").textContent = "0";
    buddyGame.setMood("idle");
    buddyGame.say(T().ready, 2000);
    renderLyrics(0);

    const mic = await ensureMic();
    if (!game || game.song !== song) return; // user left while the prompt was open
    if (mic !== "ok") {
      game.micOk = false;
      buddyGame.setMood("sleep");
      buddyGame.say(mic === "none" ? T().micNone : T().micDenied, 0);
    }

    const lead = spb * 3 + 0.4;
    game.startAt = actx.currentTime + lead;
    for (let k = 3; k >= 1; k--)
      tone(k === 1 ? 84 : 79, game.startAt - k * spb, 0.12, 0.12, "sine");
    if (settings.guide === "on") {
      notes.forEach((n) => tone(n.midi, game.startAt + n.start, n.dur, 0.14));
    }
    raf = requestAnimationFrame(loop);
  }

  function stopSong() {
    cancelAnimationFrame(raf);
    stopScheduled();
    game = null;
  }

  function median(arr) {
    const s = [...arr].sort((a, b) => a - b);
    return s[s.length >> 1];
  }

  // Wrap a semitone difference into [-6, 6) so any octave counts.
  const wrap = (d) => ((((d + 6) % 12) + 12) % 12) - 6;

  function fakeSinger(t) {
    const n = game.notes.find((x) => t >= x.start + 0.06 && t < x.end - 0.04);
    if (!n) return { hz: 0, rms: 0 };
    if (Math.sin(t * 1.7) > 0.93) return { hz: 0, rms: 0 };
    let m = n.midi + 12 + 0.3 * Math.sin(t * 11); // a child's voice, an octave up
    if (n.i % 9 === 5) m += 2.4; // occasionally off, so the buddy gives hints
    return { hz: Pitch.midiToHz(m), rms: 0.08 };
  }

  function loop() {
    if (!game) return;
    const t = actx.currentTime - game.startAt;
    const dt = Math.min(0.1, Math.max(0, t - game.lastT));
    game.lastT = t;

    // Pitch
    let res = { hz: 0, rms: 0 };
    if (FAKE) res = fakeSinger(t);
    else if (analyser) {
      analyser.getFloatTimeDomainData(timeBuf);
      res = Pitch.detect(timeBuf, actx.sampleRate);
    }
    if (res.hz > 0) {
      game.recent.push(Pitch.hzToMidi(res.hz));
      if (game.recent.length > 5) game.recent.shift();
      game.unvoiced = 0;
    } else if (++game.unvoiced > 4) {
      game.recent = [];
    }
    const raw = game.recent.length >= 2 ? median(game.recent) : null;
    game.beak +=
      ((raw !== null ? Math.min(1, 0.35 + res.rms * 8) : 0) - game.beak) * 0.35;
    buddyGame.mouth(game.beak);

    // Current and nearest note
    const active = game.notes.find((n) => t >= n.start && t < n.end) || null;
    const upcoming =
      game.notes.find((n) => n.end > t) || game.notes[game.notes.length - 1];
    const ref = active || upcoming;

    let display = null;
    let on = false;
    if (raw !== null) {
      const diff = wrap(raw - ref.midi);
      display = ref.midi + diff;
      if (t >= 0) game.anyVoice = true;
      if (active) {
        on = Math.abs(diff) <= TOLERANCE;
        if (on) {
          active.hit += dt;
          game.offAcc = Math.max(0, game.offAcc - dt * 2);
        } else {
          game.offAcc += dt;
          game.offSign += dt * Math.sign(diff);
        }
        game.silentAcc = 0;
      }
    } else if (active) {
      game.silentAcc += dt;
    }
    game.voice = display;
    game.onTime = on ? game.onTime + dt : 0;

    if (t > -0.5) {
      game.trail.push(
        display === null ? { t, gap: true } : { t, m: display, on },
      );
      while (game.trail.length && game.trail[0].t < t - 6) game.trail.shift();
    }

    // Finished notes
    for (const n of game.notes) {
      if (n.done || t < n.end) continue;
      n.done = true;
      n.good = n.hit / n.dur >= GOOD_RATIO;
      if (n.good) {
        game.score++;
        game.streak++;
        const pill = $(".score-pill");
        pill.classList.remove("pop");
        void pill.offsetWidth;
        pill.classList.add("pop");
        $("#scoreNow").textContent = game.score;
        burst(W * playFrac(), yOf(n.midi), PC_COLORS[n.midi % 12] || "#fff");
        if ([3, 6, 10, 15, 20, 30].includes(game.streak)) {
          buddyGame.say(pick(T().praise), 1600);
          buddyGame.setMood("wow", 1400);
          game.lastHint = t;
        } else {
          buddyGame.setMood("hop", 350);
        }
      } else {
        game.streak = 0;
      }
    }

    // The buddy's coaching
    if (game.micOk && t > 0) {
      if (game.offAcc > 1.0 && t - game.lastHint > 2.5) {
        buddyGame.say(game.offSign < 0 ? T().higher : T().lower, 1800);
        buddyGame.setMood("think", 1500);
        game.lastHint = t;
        game.offAcc = 0;
        game.offSign = 0;
      } else if (game.silentAcc > 3 && t - game.lastHint > 4) {
        buddyGame.say(T().singWithMe, 2000);
        buddyGame.setMood("hop", 400);
        game.lastHint = t;
        game.silentAcc = 0;
      }
      buddyGame.setBase(game.onTime > 0.25 ? "happy" : "idle");
    }

    // Countdown
    const cd = t < 0 ? Math.ceil(-t / game.spb) : t < 0.6 ? 0 : null;
    if (cd !== game.countdown) {
      game.countdown = cd;
      const el = $("#countdown");
      el.textContent =
        cd === null ? "" : cd === 0 ? "🎤" : cd > 3 ? "" : String(cd);
      el.classList.remove("tick");
      void el.offsetWidth;
      el.classList.add("tick");
      if (cd === 0 && game.micOk) buddyGame.say(T().go, 1200);
    }

    // Progress + lyrics
    const p = Math.min(1, Math.max(0, t / game.duration));
    $("#progressFill").style.width = `${p * 100}%`;
    $("#progressBuddy").style.left = `${p * 100}%`;
    if (upcoming.phrase !== game.phrase) renderLyrics(upcoming.phrase);
    updateLyrics(active);

    draw(t);

    if (t > game.duration + 1) return endSong();
    raf = requestAnimationFrame(loop);
  }

  // ---------- lyrics ----------
  function lyricOf(n) {
    const tok = n.lyric[KidsI18n.get()] || n.lyric.en;
    return tok ? tok.replace(/_/g, " ") : noteName(n.midi);
  }

  function renderLyrics(phrase) {
    const box = $("#lyrics");
    box.innerHTML = "";
    if (!game) return;
    game.phrase = phrase;
    game.notes
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
      const n = game.notes[s.dataset.i];
      s.classList.toggle("now", active === n);
      s.classList.toggle("done", n.done && !n.good);
      s.classList.toggle("good", n.good);
    });
  }

  // ---------- drawing ----------
  const playFrac = () => (W < 500 ? 0.22 : 0.28);
  const padTop = 18;
  const padBottom = 18;
  const laneH = () => (H - padTop - padBottom) / (game.maxM - game.minM + 1);
  const yOf = (m) => padTop + (game.maxM - m + 0.5) * laneH();

  function burst(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 80 + Math.random() * 180;
      game.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 60,
        life: 1,
        color,
        size: 12 + Math.random() * 12,
        ch: Math.random() < 0.6 ? "★" : "✦",
      });
    }
    game.particles.push({
      x: x + 10,
      y: y - 20,
      vx: 0,
      vy: -70,
      life: 1.3,
      color: "#ffd43b",
      size: 22,
      ch: "+1 ⭐",
      text: true,
    });
  }

  function draw(t) {
    const lh = laneH();
    const playX = W * playFrac();
    const pps = Math.max(70, (W * 0.7) / (6 * game.spb));
    g.clearRect(0, 0, W, H);

    // Lanes for the notes of the scale
    g.font = `600 ${Math.min(16, lh * 0.7)}px Fredoka, sans-serif`;
    g.textBaseline = "middle";
    for (let m = game.minM; m <= game.maxM; m++) {
      const pc = ((m % 12) + 12) % 12;
      if (!(pc in PC_COLORS)) continue;
      const y = yOf(m);
      g.fillStyle = "rgba(255,255,255,0.05)";
      g.fillRect(0, y - lh / 2 + 1, W, lh - 2);
      g.fillStyle = PC_COLORS[pc];
      g.globalAlpha = 0.7;
      g.textAlign = "left";
      g.fillText(noteName(m), 8, y);
      g.globalAlpha = 1;
    }

    // Playhead
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.setLineDash([6, 8]);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(playX, 0);
    g.lineTo(playX, H);
    g.stroke();
    g.setLineDash([]);

    // Notes
    const noteH = Math.max(14, Math.min(lh * 0.84, 46));
    g.textAlign = "center";
    for (const n of game.notes) {
      const x = playX + (n.start - t) * pps;
      const w = n.dur * pps - 5;
      if (x > W + 10 || x + w < -10) continue;
      const y = yOf(n.midi) - noteH / 2;
      const color = PC_COLORS[((n.midi % 12) + 12) % 12] || "#ccc";
      const isActive = t >= n.start && t < n.end;

      g.save();
      if (n.done && !n.good) g.globalAlpha = 0.3;
      if (isActive) {
        g.shadowColor = color;
        g.shadowBlur = 22;
      }
      g.fillStyle = n.good ? "#ffd43b" : color;
      g.beginPath();
      g.roundRect(x, y, w, noteH, noteH / 2);
      g.fill();
      g.shadowBlur = 0;

      // How much of this note has been sung on pitch
      if (!n.done && n.hit > 0) {
        g.fillStyle = "rgba(255,255,255,0.55)";
        g.beginPath();
        g.roundRect(x, y, Math.min(w, (n.hit / n.dur) * w), noteH, noteH / 2);
        g.fill();
      }
      if (w > 26) {
        g.fillStyle = "#26315c";
        g.font = `700 ${Math.min(18, noteH * 0.5)}px Fredoka, sans-serif`;
        g.fillText(
          n.good ? `★ ${noteName(n.midi)}` : noteName(n.midi),
          x + w / 2,
          y + noteH / 2 + 1,
        );
      }
      g.restore();
    }

    // Voice trail
    g.lineCap = "round";
    g.lineJoin = "round";
    g.lineWidth = 7;
    let prev = null;
    for (const p of game.trail) {
      if (p.gap) {
        prev = null;
        continue;
      }
      const x = playX - (t - p.t) * pps;
      const y = clampY(yOf(p.m));
      if (prev) {
        g.strokeStyle = p.on ? "#69f0ae" : "rgba(255,255,255,0.75)";
        g.beginPath();
        g.moveTo(prev.x, prev.y);
        g.lineTo(x, y);
        g.stroke();
      }
      prev = { x, y };
    }

    // Voice dot
    if (game.voice !== null) {
      const y = clampY(yOf(game.voice));
      const on = game.onTime > 0;
      g.fillStyle = on ? "#69f0ae" : "#fff";
      g.shadowColor = on ? "#69f0ae" : "#fff";
      g.shadowBlur = 24;
      g.beginPath();
      g.arc(playX, y, 13, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      g.font = "18px sans-serif";
      g.fillText("🎤", playX, y + 1);
    }

    // Particles
    const dt = 1 / 60;
    game.particles = game.particles.filter((p) => (p.life -= dt * 1.1) > 0);
    for (const p of game.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (!p.text) p.vy += 300 * dt;
      g.globalAlpha = Math.min(1, p.life);
      g.fillStyle = p.color;
      g.font = `700 ${p.size}px Fredoka, sans-serif`;
      g.fillText(p.ch, p.x, p.y);
    }
    g.globalAlpha = 1;
  }

  const clampY = (y) => Math.max(10, Math.min(H - 10, y));

  // ---------- results ----------
  function endSong() {
    const { song, score, notes, anyVoice } = game;
    stopSong();
    const pct = score / notes.length;
    let stars = pct >= 0.75 ? 3 : pct >= 0.5 ? 2 : pct >= 0.2 ? 1 : 0;
    if (anyVoice) stars = Math.max(1, stars); // singing at all earns a star
    if (stars > (best[song.id] || 0)) {
      best[song.id] = stars;
      KidsStore.save("sing.best", best);
      reportProgress();
    }

    show("results");
    applyI18n();
    $("#resultLine").textContent = T().resultLine(score, notes.length);
    buddyResult.say(T().results[stars], 0);
    buddyResult.setMood(stars >= 2 ? "happy" : stars === 1 ? "idle" : "think");

    const spans = [...document.querySelectorAll("#bigStars span")];
    spans.forEach((s) => (s.className = ""));
    spans.forEach((s, i) =>
      setTimeout(
        () => {
          s.className = i < stars ? "on" : "dim";
          if (i < stars) tone(79 + i * 4, actx.currentTime, 0.25, 0.14, "sine");
        },
        500 + i * 450,
      ),
    );
    if (stars >= 2) KidsFx.confetti();
    $("#btnAgain").onclick = () => startSong(song);
  }
  $("#btnSongs").addEventListener("click", goHome);
  $("#btnBack").addEventListener("click", goHome);
  document.addEventListener(
    "keydown",
    (e) => e.key === "Escape" && game && goHome(),
  );

  reportProgress();
  goHome();
})();
