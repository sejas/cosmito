# Contributing

Thanks for helping kids learn! A few principles:

- **Kids first.** Big tap targets (≥ 60px), few words, lots of feedback. Mistakes get a gentle hint, never a punishment.
- **Every word translated.** No hard-coded user-facing text: everything goes through a dictionary.
- **No build, no dependencies.** Plain HTML/CSS/JS with classic `<script>` tags, so anyone can open a file and hack on it.
- **Private by default.** No analytics, no accounts, no network calls besides the Google Font. Progress stays in the browser (`KidsStore`).
- Works on a phone (390px wide, no sideways scroll) and respects `prefers-reduced-motion`.

## Add a game

1. Create `games/<your-game>/index.html`. Load the Fredoka font, `../../shared/base.css`, `../../shared/mascot.css`, then the shared scripts in this order: `storage.js`, `i18n.js`, `audio.js`, `fx.js`, `mascot.js`, `mascots/<mascot>.js`.
2. Put all text in a dictionary `{ en: {...}, es: {...} }` and use `KidsI18n.translator(dict)`, `KidsI18n.apply(dict)` for `[data-i18n]` elements, and `KidsI18n.mountPicker(button)` for the language chip. Re-render on `KidsI18n.onChange`.
3. Link back to the hub (`../../index.html`) from your home screen.
4. Report stars with `KidsStore.setProgress("<your-game>", stars, maxStars)`.
5. Add an entry to `hub/games.js`, using the same `maxStars`.
6. Add tests for pure logic where it makes sense (`games/<your-game>/js/*.test.js`, run with `node --test`).

## Build a 3D version

Follow [3d/README.md](3d/README.md). Shared scripts (`KidsI18n`, `Mascots`…) are top-level `const`s, not properties of `window`: ES modules reach them by bare name or through `Kit.I18N()` etc.

## Add a language

1. Add it to `LANGS` in `shared/i18n.js`.
2. Add a block for it to every dictionary: `hub/hub.js`, each game's dictionary, and the `{en, es}` fields in `hub/games.js`, `games/sing/js/songs.js` and each mascot.

Missing keys fall back to English, so partial translations still work.

## Add a mascot

1. Copy `shared/mascots/pipo.js` and draw your friend as an SVG using the class contract described at the top of `shared/mascot.js`: `.eyes-open` (`.pupil`, `.lid`), `.eyes-happy`, `.eyes-closed`, `.mouth`, `.limb.l`/`.limb.r`, `.sparkles`, `.zzz`, `.float`.
   Read the drawing rules in that comment too (no `transform` attribute on animated parts, where decorations go). Also add `sound` and a `treat` (their favourite food, which games use as the reward).
2. Open `shared/mascots/preview.html` to check every mood: idle, happy, wow, think, sleep, hop.
3. Add a `<script>` for it to the hub (`index.html`). It will appear with the other friends.

## Silent automated tests

Browser tests must never make sound on the developer's machine. Launch Chrome with `--mute-audio`, and before loading pages stub read-aloud and mute the games:

```js
await context.addInitScript(() => {
  if (window.speechSynthesis) speechSynthesis.speak = () => {}; // --mute-audio doesn't cover OS speech on macOS
  localStorage.setItem("kids.muted", "true");
});
```

## Checks before a pull request

```sh
node --test games/*/js/*.test.js "3d/**/*.test.js"   # logic tests
python3 -m http.server 8000   # then play your change in the browser, desktop and phone width
```
