# AGENTS.md

Guide for coding agents and contributors. Read this before changing anything. For how to run the project, see [README.md](README.md). For step-by-step recipes (add a game, language or mascot), see [CONTRIBUTING.md](CONTRIBUTING.md). For the 3D kit API, see [3d/README.md](3d/README.md).

## What this is

A free, open-source (MIT) collection of learning games for kids aged about 3–9:
- **Classic 2D edition:** hub `index.html` plus `games/<id>/`.
- **3D edition:** three.js in `3d/`: the hub, a shared kit in `3d/kit/`, and games in `3d/games/<id>/`.

Everything is available in English and Spanish, can be played with any mascot, and has no ads, accounts or tracking.

## Non-negotiable rules

1. **Kids first.**
   - Big tap targets (≥ 60px).
   - Mostly wordless or short text, with voice and icons for pre-readers.
   - Mistakes get a gentle hint and a retry, never a punishment: no lives, no timers except in explicit "rush" modes.
2. **Every visible string is in a dictionary**, both `en` and `es`.
   - That includes `aria-label`s and `document.title`.
   - A string that mentions the buddy or its treat is a function: `(name, treats) => …`.
   - Spanish nouns change gender with the treat, so avoid articles next to treat names ("pimientos rojos" vs "mazorcas").
3. **Any game works with any mascot.** Never hard-code "Pipo", "Bollo", corn or peppers in game code.
   - Get the buddy from `Mascots.buddy("<default>")`.
   - Get its name, sound and treat from the mascot definition (`Mascots.treatEl`, `treatName`, `treatOf`; `mascot.sound()`).
   - Swap live on `Mascots.onBuddyChange` → `mascot.use(id)`.
4. **2D: no build, no npm dependencies.**
   - Plain HTML/CSS/JS with classic `<script>`s, each file an IIFE.
   - 3D is the one exception: it uses ES modules and three.js, which is **vendored** in `vendor/three/` (no CDN, for offline use and privacy).
5. **Private.**
   - No analytics or third-party requests besides the Google Font.
   - Progress lives in `localStorage` through `KidsStore`, with keys prefixed `kids.` and namespaced per game.
6. **Shared progress.** A game's 2D and 3D versions use the **same** storage keys and the same `KidsStore.setProgress(id, stars, max)`. `maxStars` must match the entry in `hub/games.js`.
7. **Phone-first.**
   - Test at 390×844, 768×1024 and 1280×800.
   - `document.documentElement.scrollWidth <= innerWidth` must always hold.
   - Respect `prefers-reduced-motion`.

## Architecture

```
index.html, hub/            2D hub. hub/games.js = game catalogue + shared ranks (HUB_RANKS, hubRank)
shared/                     classic scripts every page loads, in this order:
  storage.js  KidsStore      guarded localStorage + per-game progress
  i18n.js     KidsI18n       global language; translator(dict), apply(dict), mountPicker, onChange, pickLang
  audio.js    KidsAudio      Web Audio synth: ensure() after a user gesture, sfx(name), tone(); honours mute
  fx.js       KidsFx         confetti, burst (emoji or image URLs), KidsFx.PEPPER
  mascot.js   Mascots        registry, mood contract, buddy choice, treats (+ mascot.css)
  mascots/*.js               one file per mascot; preview.html shows every mascot in every mood
  icons/                     shared SVG icons (e.g. the red pepper treat)
games/<id>/                 index.html, style.css, js/i18n.js, js/<pure-logic>.js (+ .test.js), js/app.js
3d/                         3D hub (index.html + hub/), kit/ (kit.js is the entry point), games/<id>/
3d/games/ready.js           ids that have a 3D version; the 3D hub shows "Soon in 3D" for the rest
vendor/three/               three.js r186, bundled into one minified module (see VERSION.md)
```

**Pure logic is separate from the UI.**
- Question generators, interpreters, colour mixing, clock phrasing and scoring live in `games/<id>/js/<logic>.js`.
- Each logic file is a classic script that defines a global and also ends with `if (typeof module !== "undefined") module.exports = …`.
- That's why 3D versions can **load the 2D logic as classic scripts instead of copying it**, keeping both editions' rules identical.

## Contracts you must keep

**Mascot SVG** (top of `shared/mascot.js`).
- Required classes: `.eyes-open` (containing `.pupil` and `.lid`), `.eyes-happy`, `.eyes-closed`, `.mouth` (scaled by `--mouth`), `.limb.l`/`.limb.r`, `.sparkles`, `.zzz`, `.float`.
- Moods: idle, happy, wow, think, sleep, hop.
- Drawing rules:
  - Don't put a `transform` attribute on animated parts; wrap them in an inner `<g>`.
  - `.float` goes top-left and `.zzz` top-right.
- Every mascot defines `sound` and a `treat` (its favourite food, used as the reward). Games fall back to ⭐ if a treat is missing.
- 3D mascots use the **same mood API** (`Kit.mascot` / `Kit.buddyMascot`).

**Shared globals aren't on `window`.** `KidsI18n`, `Mascots` and the rest are top-level `const`s.
- ES modules reach them by bare name, or through `Kit.I18N()`, `STORE()`, `AUDIO()`, `FX()` and `MASCOTS()`.
- `window.KidsI18n` is `undefined`.

**3D kit rules** (all documented in `3d/README.md`):
- `Kit.toon/flat/candy` return **cached, shared** materials. Pass `{ unique: true }` before changing opacity or colour.
- Objects under a hidden parent can't be picked, and their keyboard buttons hide too.
- Pinned HTML moves with the CSS `translate` property, so a `scale` on `:active` is safe.
- Use `pin(…, { clamp })` for bubbles.
- `setView` / `fit` / `fitPoints` cancel any camera move still running.
- Call `stage.clearBursts()` when changing screens.
- A custom header must carry `data-kit-hud`, so the "running slow?" toast sits below it.
- Every 3D page needs a WebGL2 fallback that links to its 2D page (the `createStage({ fallback })` option).
- Budget: 60 fps on a laptop, ≥ 30 fps on a cheap tablet. Use `InstancedMesh` / `Kit.TreatInstances` for repeated treats, and keep an eye on `stage.stats`.

## Testing

```sh
node --test games/*/js/*.test.js "3d/**/*.test.js"   # Node 22 needs globs; a folder path fails
python3 -m http.server 8000                          # then play it in a real browser
```

- **Every game's pure logic has `node:test` tests.** Prove content properties, don't just smoke-test. Examples from this repo:
  - every Code level is solvable in its stated best number of blocks (checked by search)
  - all 144 five-minute clock phrases are exact in both languages
  - every paint mix gives the right named colour in any pour order
  - spelling tiles can always form the word
  - lyrics line up with notes
- **Browser tests are headless and SILENT.** A developer asked for this after agents kept speaking out loud.
  - Launch Chrome with `--mute-audio`.
  - Before loading pages, run `context.addInitScript(() => { speechSynthesis.speak = () => {}; localStorage.setItem("kids.muted", "true"); })`. `--mute-audio` doesn't silence OS speech on macOS.
  - Never run `say` without `-o file`, and never `afplay`.
- **Use real viewports** via `browser.newContext({ viewport })`. `--window-size` in desktop Chrome can't go below about 500px, so it silently lays out wider than the screenshot.
- **3D in headless Chrome:** `--use-angle=metal` for real-GPU numbers; `--use-angle=swiftshader --enable-unsafe-swiftshader` for the worst case.
- **Fakes for hardware:** `games/sing/?fake=1` simulates a singer (no microphone). Several games accept query hooks (`?level=`, `?play=`) for testing only.
- **Check each screenshot yourself.** Most layout bugs here (overlapping bubbles, clipped options, bubbles off screen) were found by looking, not by assertions.

## Gotchas we hit

- **A shared rule that sets `display` beats the `hidden` attribute.** `base.css` restores it with `[hidden] { display: none !important; }`.
- **Scale animations cause sideways scroll.** `pop` at 1.25× on wide elements scrolls phones sideways; use `pop-sm`.
- **Speech bubbles near the edges** overflowed on phones in almost every game. Clamp them, or give them `max-width` plus a centred position.
- **Web Speech picks the wrong voice.** It picks the *first* voice for a language (robotic "Eddy" for Spanish on macOS), and for about 0.4 s after load only remote Google voices exist, which sends text to Google. Score voices and prefer local ones; see the voice research notes. A shared `KidsVoice` is still to do, and several games have their own `speak()` copies.
- **Mic pitch detection:** YIN on 2048 samples with a median of recent frames. Match in **any octave** (a child sings the notes an octave higher), with ±1 semitone of tolerance.
- **three.js labels:** redraw the canvas texture *and replace the GPU texture* when the text or font changes its size, or WebGL errors and clips the text. This is fixed in `Kit.label`.
- **Colour mixing:** naive RGB averaging turns blue + yellow into grey. `games/colors` uses an RYB model plus pigment-like tints and shades.
- **Static hosting caches:** some servers send `.js`/`.css` as `immutable` for 30 days. Version the file URLs when you redeploy, or returning visitors run stale scripts.
- **Trademark check:** "PIPO" is an active Spanish trademark for kids' software. Check names (project and mascots) for trademarks and for slang in *all* Spanish variants before publishing ("Bollo" has slang meanings in Spain and Cuba). A rename is pending.

## Working with parallel agents (how this repo was built)

- **Write shared contracts first, then fan out.** Shared layer, mascot contract and kit came first, then one agent per game, each owning its own folder. The 3D edition went: foundation agent → 3 game agents → one "kit polish" agent that fixed, once, the problems the game agents reported.
- **Give every agent full context.** Paths, APIs, rules, done criteria, the silent-test rule, "only edit these folders", and "propose shared changes in your report, don't make them".
- **Isolation: a real `git worktree add` per agent**, on its own branch, merged with `--no-ff` after checking `git diff --name-only main...branch` only touches the agent's folders. If the session was started from a parent directory that is itself a git repo, automatic worktree isolation may check out the wrong repo; create worktrees from this repo explicitly.
- **Merge-friendly shared lists:** one id per line with a separator (`3d/games/ready.js`), so parallel branches don't conflict.
- **Commit early and often.** An agent lost work when the machine went to sleep mid-run.
- **Separate commands with `&&`, never newlines, when an error must stop the rest.** A failed edit script was followed by a commit because the steps were on separate lines.
