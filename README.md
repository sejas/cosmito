# Pipo & Friends 🎈

Free, open-source learning games for kids. No ads, no accounts, no tracking. Just open it and play.

| Game | Default buddy | Learn |
| --- | --- | --- |
| 🎤 **Sing with Pipo**: sing along and match the notes (the microphone listens to your pitch) | 🐤 Pipo | Music, pitch |
| 🔢 **Times Tables with Bollo**: learn, practise and race through the times tables | 🐹 Bollo the guinea pig | Multiplication |
| 🧩 **Code with Pipo**: wordless coding puzzles with arrows, loops, debugging and conditionals (ages 4–9) | 🐤 Pipo | Coding, logic |
| 🎨 **Color Lab with Pipo**: colour names, a paint-mixing lab and colour-by-symbol pictures (ages 3–7) | 🐤 Pipo | Colours, mixing |
| 📚 **Words with Pipo**: picture vocabulary in English and Spanish (listen, read, spell, memory, sticker book) | 🐤 Pipo | Vocabulary, languages |
| 🕐 **Tell the Time with Bollo**: read and set an analog clock, match digital times and plan the buddy's day (ages 5–9) | 🐹 Bollo the guinea pig | Telling time |

Every game is available in **English and Spanish**, and can be played with **any mascot**. Pick your buddy and language once on the hub; every game follows.

## Run it

It's plain HTML, CSS and JavaScript. There's no build step and nothing to install.

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Any static host works (GitHub Pages, Netlify, …). The singing game needs **HTTPS** (or `localhost`) because browsers only allow the microphone on secure pages.

Handy for testing: `games/sing/?fake=1` replaces the microphone with a simulated singer.

## Project layout

```
index.html            hub: all games, the mascots, total stars
hub/                  hub code + games.js (the game catalogue)
shared/               used by every game
  base.css            colours, buttons, clouds, cards
  i18n.js             KidsI18n: global language, dictionaries, language picker
  storage.js          KidsStore: safe localStorage + progress per game
  audio.js            KidsAudio: synth sound effects (no audio files)
  fx.js               KidsFx: confetti and emoji bursts
  mascot.js/.css      Mascots: mascot framework and moods
  mascots/            pipo.js, bollo.js, preview.html (every mascot in every mood)
games/<game>/         one folder per game
3d/                   Pipo & Friends 3D: three.js hub, kit (3d/kit/) and 3D games
vendor/three/         three.js, kept in the repo (MIT), so no CDN is needed
```

## 3D edition

`3d/` is a three.js version of the collection: a floating-island hub where each game is a portal, and toy-like 3D versions of the mascots. It shares progress, language and buddy with the classic games, and falls back to them on devices without WebGL2. See [3d/README.md](3d/README.md) to build a 3D game.

## Lessons learned

This project was built mostly by AI coding agents working in parallel, with a human choosing direction. What worked, and what we'd do again:

- **Design for the youngest player.** Big targets, few words, voice and icons, and mistakes that teach instead of punish. Kids who can't read yet rely on the voice, so voice quality matters.
- **One shared layer, many small games.** Language, storage, sound, effects and mascots are shared, so every new game gets two languages, any buddy and saved progress for free.
- **Mascots are data, not hard-coded characters.** Each mascot brings its name, sound and favourite treat, so "play times tables with the guinea pig and collect peppers" needs no extra code.
- **Keep game rules in plain, tested logic.** The 3D edition reuses the 2D rules unchanged, so both versions stay identical and share progress.
- **Test what content promises,** such as every puzzle being solvable and every phrase being correct in both languages, and look at screenshots at phone size.
- **Check names before you publish.** Look for trademarks and slang in every variant of each language.

The details are in [AGENTS.md](AGENTS.md).

## Contributing

New games, languages and mascots are very welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
