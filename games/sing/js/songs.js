// Songs use the same notation as ../piano: Name[octave][#][/duration], "|" splits phrases.
// Octave defaults to 4. Durations: r=4 beats, b=2, n=1 (default), c=1/2, s=1/4.
// Lyrics: one token per note, same "|" phrases. A trailing "-" joins a syllable to the next,
// "_" renders as a space inside one syllable.
const SONGS = (() => {
  const SEMITONE = { Do: 0, Re: 2, Mi: 4, Fa: 5, Sol: 7, La: 9, Si: 11 };
  const BEATS = { r: 4, b: 2, n: 1, c: 0.5, s: 0.25 };

  const raw = [
    {
      id: "warmup",
      emoji: "🌈",
      color: "#ff8fab",
      bpm: 70,
      level: 1,
      title: { en: "Do Re Mi Warm-up", es: "Calentamiento Do Re Mi" },
      notes:
        "Do/b Re/b Mi/b Fa/b Sol/b La/b Si/b Do5/r | Do5/b Si/b La/b Sol/b Fa/b Mi/b Re/b Do/r",
      lyrics: null,
    },
    {
      id: "twinkle",
      emoji: "⭐",
      color: "#ffd166",
      bpm: 90,
      level: 1,
      title: {
        en: "Twinkle Twinkle Little Star",
        es: "Estrellita, ¿dónde estás?",
      },
      notes:
        "Do Do Sol Sol La La Sol/b | Fa Fa Mi Mi Re Re Do/b | Sol Sol Fa Fa Mi Mi Re/b | Sol Sol Fa Fa Mi Mi Re/b | Do Do Sol Sol La La Sol/b | Fa Fa Mi Mi Re Re Do/b",
      lyrics: {
        en: "Twin- kle twin- kle lit- tle star | how I won- der what you are | up a- bove the world so high | like a dia- mond in the sky | twin- kle twin- kle lit- tle star | how I won- der what you are",
        es: "Es- tre- lli- ta ¿dón- de_es- tás? | me pre- gun- to qué se- rás | en el cie- lo_o en el mar | un dia- man- te de ver- dad | Es- tre- lli- ta ¿dón- de_es- tás? | me pre- gun- to qué se- rás",
      },
    },
    {
      id: "mary",
      emoji: "🐑",
      color: "#9bf6ff",
      bpm: 100,
      level: 1,
      title: { en: "Mary Had a Little Lamb", es: "María tenía un corderito" },
      notes:
        "Mi Re Do Re Mi Mi Mi/b | Re Re Re/b | Mi Sol Sol/b | Mi Re Do Re Mi Mi Mi Mi | Re Re Mi Re Do/r",
      lyrics: {
        en: "Ma- ry had a lit- tle lamb | lit- tle lamb | lit- tle lamb | Ma- ry had a lit- tle lamb its | fleece was white as snow",
      },
    },
    {
      id: "martinillo",
      emoji: "🔔",
      color: "#caffbf",
      bpm: 100,
      level: 2,
      title: { en: "Are You Sleeping?", es: "Martinillo" },
      notes:
        "Do Re Mi Do | Do Re Mi Do | Mi Fa Sol/b | Mi Fa Sol/b | Sol/c La/c Sol/c Fa/c Mi Do | Sol/c La/c Sol/c Fa/c Mi Do | Do Sol3 Do/b | Do Sol3 Do/b",
      lyrics: {
        en: "Are you sleep- ing | are you sleep- ing | Bro- ther John | Bro- ther John | Mor- ning bells are ring- ing | mor- ning bells are ring- ing | ding dang dong | ding dang dong",
        es: "Mar- ti- ni- llo | Mar- ti- ni- llo | ¿dón- de_es- tás? | ¿dón- de_es- tás? | To- ca la cam- pa- na | to- ca la cam- pa- na | din don dan | din don dan",
      },
    },
    {
      id: "birthday",
      emoji: "🎂",
      color: "#bdb2ff",
      bpm: 90,
      level: 3,
      title: { en: "Happy Birthday", es: "Cumpleaños feliz" },
      notes:
        "Sol/c Sol/c La Sol Do5 Si/b | Sol/c Sol/c La Sol Re5 Do5/b | Sol/c Sol/c Sol5 Mi5 Do5 Si La | Fa5/c Fa5/c Mi5 Do5 Re5 Do5/b",
      lyrics: {
        en: "Hap- py birth- day to you | hap- py birth- day to you | hap- py birth- day my dear friend | hap- py birth- day to you",
        es: "Cum- ple- a- ños fe- liz | cum- ple- a- ños fe- liz | te de- se- a- mos to- dos | cum- ple- a- ños fe- liz",
      },
    },
  ];

  function parseToken(tok) {
    const m = tok.match(/^(Do|Re|Mi|Fa|Sol|La|Si)(\d)?(#)?(?:\/([rbncs]))?$/);
    if (!m) throw new Error(`Bad note token: ${tok}`);
    const octave = m[2] ? Number(m[2]) : 4;
    return {
      midi: (octave + 1) * 12 + SEMITONE[m[1]] + (m[3] ? 1 : 0),
      beats: BEATS[m[4] || "n"],
    };
  }

  function phrases(str) {
    return str.split("|").map((p) => p.trim().split(/\s+/).filter(Boolean));
  }

  function build(song) {
    const notePhrases = phrases(song.notes);
    const lyricPhrases = {};
    for (const [lang, text] of Object.entries(song.lyrics || {})) {
      lyricPhrases[lang] = phrases(text);
      const counts = lyricPhrases[lang].map((p) => p.length).join();
      if (counts !== notePhrases.map((p) => p.length).join()) {
        console.warn(`Lyrics/notes mismatch in ${song.id} (${lang})`);
      }
    }

    const notes = [];
    let beat = 0;
    notePhrases.forEach((phrase, pi) => {
      phrase.forEach((tok, ni) => {
        const n = parseToken(tok);
        const lyric = {};
        for (const lang in lyricPhrases)
          lyric[lang] = lyricPhrases[lang][pi]?.[ni] ?? "";
        notes.push({ ...n, startBeat: beat, phrase: pi, lyric });
        beat += n.beats;
      });
    });
    return {
      ...song,
      notes,
      totalBeats: beat,
      phraseCount: notePhrases.length,
    };
  }

  return raw.map(build);
})();
