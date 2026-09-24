# Pipo & Friends 🎈

Free, open-source learning games for kids. No ads, no accounts, no tracking. Just open it and play.

| Game | Default buddy | Learn |
| --- | --- | --- |
| 🎤 **Sing with Pipo**: sing along and match the notes (the microphone listens to your pitch) | 🐤 Pipo | Music, pitch |
| 🔢 **Times Tables with Bollo**: learn, practise and race through the times tables | 🐹 Bollo the guinea pig | Multiplication |
| 🧩 **Code with Pipo**: wordless coding puzzles with arrows, loops, debugging and conditionals (ages 4–9) | 🐤 Pipo | Coding, logic |
| 🎨 **Color Lab with Pipo**: colour names, a paint-mixing lab and colour-by-symbol pictures (ages 3–7) | 🐤 Pipo | Colours, mixing |

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
```

## Contributing

New games, languages and mascots are very welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
