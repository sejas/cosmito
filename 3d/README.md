# Pipo & Friends 3D

A three.js edition of the games: soft toy-like 3D, glass panels floating over a
bright sky, the buddy reacting to everything. Same rules as the 2D games (see
[CONTRIBUTING.md](../CONTRIBUTING.md)): no build step, no npm dependencies, every word
translated, private by default, works on a phone, respects reduced motion.

```
3d/
  index.html        the 3D hub: a floating island, one portal per game
  hub/              hub code (island, portals, layout logic + tests); ranks come from ../hub/games.js, shared with the 2D hub
  kit/              the shared 3D kit (import kit.js)
    demo.html       live reference: every mascot in every mood, treats, particles, glass UI
  games/            one flat folder per 3D game: games/<id>/index.html + <id>3d.js, logic.js…
    ready.js        list of games that have a 3D version (the hub reads it)
vendor/three/       three.js r186, vendored (see VERSION.md)
```

Open `http://localhost:8000/3d/` (serve the repo root with `python3 -m http.server 8000`).
Progress, stars, buddy, language and mute are shared with the 2D games (same `KidsStore` keys).

## Build a 3D game

1. Create `3d/games/<id>/index.html` (the `id` from `hub/games.js`). Copy this skeleton:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Sing with Pipo 3D</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎤</text></svg>" />
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../../../shared/base.css" />
  <link rel="stylesheet" href="../../kit/ui.css" />
  <script type="importmap">
    { "imports": { "three": "../../../vendor/three/three.module.min.js", "three/addons/": "../../../vendor/three/addons/" } }
  </script>
</head>
<body>
  <nav class="kit-hud">
    <a class="kit-chip" href="../../index.html" data-i18n="home" data-i18n-aria="homeLabel"></a>
    <button class="kit-chip" id="btnBuddy" type="button"></button>
    <button class="kit-chip" id="btnLang" type="button"></button>
    <button class="kit-chip" id="btnSound" type="button"></button>
  </nav>
  <!-- the shared classic-script layer, in this order -->
  <script src="../../../shared/storage.js"></script>
  <script src="../../../shared/i18n.js"></script>
  <script src="../../../shared/audio.js"></script>
  <script src="../../../shared/fx.js"></script>
  <script src="../../../shared/mascot.js"></script>
  <script src="../../../shared/mascots/pipo.js"></script>
  <script src="../../../shared/mascots/bollo.js"></script>
  <script type="module" src="app.js"></script>
</body>
</html>
```

```js
// 3d/games/<id>/app.js — game folders are flat (no js/ subfolder), so the kit
// is two levels up: import it from "../../kit/kit.js".
import * as THREE from "three";
import * as Kit from "../../kit/kit.js";

const stage = Kit.createStage({ fallback: "../../../games/sing/" }); // 2D version of THIS game
Kit.ui.buddyChip(document.querySelector("#btnBuddy"), "pipo");
Kit.ui.langChip(document.querySelector("#btnLang"));
Kit.ui.soundChip(document.querySelector("#btnSound"));
KidsI18n.apply(Kit.KIT_DICT); // fills the "home" chip; use your own dict for your texts
if (stage) {
  const buddy = Kit.buddyMascot(stage, "pipo"); // the player's buddy, swaps live
  buddy.lookAt("pointer");
  stage.onResize(() => stage.fit({ center: [0, 1, 0], width: 6, height: 4 }));
  stage.tap(buddy.object, { label: () => KidsI18n.pickLang(buddy.def.name), onTap: () => buddy.celebrate() });
}
```

2. Put all text in `{ en, es }` dictionaries (`KidsI18n.translator(dict)`), re-render on `KidsI18n.onChange`.
3. Report stars with `KidsStore.setProgress("<id>", stars, maxStars)`, same `maxStars` as `hub/games.js`, so 2D and 3D share progress.
4. Add your id to `3d/games/ready.js` (uncomment its line). The hub then opens it in 3D instead of "Soon in 3D".
5. Pure logic goes in its own module with a `*.test.js` next to it: `node --test "3d/**/*.test.js"`.
6. Check it in a browser at 390×844, 768×1024 and 1280×800, and with WebGL disabled (you must see the fallback). Browser tests must be silent: see CONTRIBUTING.md.

Shared globals (`KidsI18n`, `KidsStore`, `KidsAudio`, `KidsFx`, `Mascots`) are top-level `const`s from classic
scripts: modules can use them by bare name, but **`window.KidsI18n` is `undefined`**. Inside the kit use
`Kit.I18N()`, `Kit.AUDIO()`… which return `null` when a script isn't loaded.

## Kit reference (`import * as Kit from ".../kit/kit.js"`)

### Stage

`Kit.createStage(opts)` → `stage`, or `null` when WebGL 2 is unavailable (a friendly glass card then links to `opts.fallback`).

| option | default | |
| --- | --- | --- |
| `container` | full-viewport layer | element to fill (inline stages pause when scrolled off-screen) |
| `fallback` | `"../index.html"` | the 2D version of this page |
| `sky` | `true` | gradient sky + fog; or `{ top, middle, bottom }`; `false` = transparent |
| `fov`, `camera` | `40`, `{ position, target }` | |
| `parallax` | `0.5` | world units the camera drifts with pointer/device tilt (0 with reduced motion) |
| `quality` | `"auto"` | or force `0`/`1`/`2` |
| `shadows` | `true` | real shadows, only at quality 2 |

`stage` has: `scene`, `camera`, `renderer`, `overlay` (HTML layer), `lights {hemi, key, fill}`, `stats {fps, level, drawCalls, triangles}`, `quality` (current settings), `reducedMotion`, `time`, `size`, `pointer`.

- `onFrame((dt, t) => …)` → unsubscribe. `onResize((w, h, aspect) => …)` runs now and on every resize.
- `fit({ center, width, height, elevation = 20, azimuth = 0, margin = 1.1 }, ms?)` frames an area for any aspect, treating it as a flat card facing the camera. Call it in `onResize`.
- `fitPoints(points, { elevation = 55, azimuth = 0, margin = 1.04, insets, minFree = 0.3 }, ms?, ease?)` frames world points (`[x, y, z]`) exactly, perspective included, so the near row of a deep board is never clipped. `insets` = CSS px to keep free at each edge (`{ top, bottom, left, right }`, e.g. your HUD panels); the points are centred in the rest. Describe the area with `Kit.boxPoints(min, max)` (8 corners) or `Kit.ellipsePoints(center, rx, rz, ys, n)` (islands, round arenas). The pure `Kit.fitPoints({ points, fov, viewW, viewH, insets, … })` returns the view without moving the camera.
- `setView({ position, target }, ms?, ease?)` → Promise (`true` when it arrives, `false` when cancelled) with a `cancel()` method. **The newest camera move wins**: `setView`, `fit` and `fitPoints` cancel any move still running. Camera moves are instant with reduced motion.
- `refit()` re-runs every `onResize` handler now, e.g. after your HUD changed height (the language changed, a panel opened).
- `tween({ from, to, ms, delay, ease, onUpdate(v, k), onDone })` → `{ done, cancel() }`. Eases: `linear, inQuad, outQuad, inOutQuad, outCubic, inOutCubic, outBack, outElastic, outBounce`.
- `tap(object, { onTap, onHover(on), label, squish = true, hitRadius, hitOffset })` → `{ button, setBase(), refreshLabel(), kick(v = -6), enabled, remove() }`. Press squish + release bounce are automatic; `kick()` plays the same squish from code (e.g. when a key press answers). **Always pass `label`** (string or function, re-read on language change): it creates an invisible focusable `<button>` pinned on the object for keyboard and screen readers. `hitRadius` adds an invisible sphere so small things are easy to hit. Call `setBase()` after changing the object's scale yourself.
  **Hidden things aren't tappable**: an object is only picked when it and every parent are `.visible`, and its keyboard button hides with it. Hide a group to switch off everything in it; `enabled = false` is for things that stay visible.
- `pin(element, object, { offset, align: "center" | "bottom" | "top" | "left", clamp = false, followVisible = false })` → `{ setOffset, setAlign, hidden, x, y, remove() }`: keeps an HTML element glued to a 3D point. `clamp: 10` keeps it fully on screen with a 10 px margin and sets `--kit-tail-x` on it (px from its centre to the anchor, so a tail can point at it; mascot speech bubbles do this). `followVisible` hides it while the object or a parent is hidden. Pins move with the CSS `translate` property, so press effects on a pinned element are safe: `.my-label:active { scale: 0.94 }` (or `transform: scale()`) shrinks it in place and the click still lands. Don't set `translate` on a pinned element yourself.
- `toScreen(vec3)`, `pointerOnPlane(y)`, `pointerActive`.
- `burst(position, { shape: "star" | "confetti" | "dot", count, colors, speed, up, spread, life, size })`, `confetti()`. Counts shrink on low quality and with reduced motion. `clearBursts()` removes every bit still flying (call it when you change screens, so confetti doesn't follow the player).
- `pause()`, `resume()`, `dispose()`. The loop already pauses when the tab is hidden or the stage is off-screen.

Adaptive quality: level 2 (DPR ≤ 2, shadows), 1 (DPR ≤ 1.5), 0 (DPR 1, fewer particles, no glass blur: adds `html.kit-lowfx`). It starts from device hints, drops a level after 2 s below 45 fps, climbs back once after 8 s above 57 fps, and if even level 0 stays under 22 fps it shows a toast offering the classic version (at the top, under the HUD, so it never covers your bottom panels; dialogs sit above it).

### Mascots (same mood API as 2D)

```js
const m = Kit.mascot(stage, "bollo", { scale: 1, bubble: true });  // or Kit.buddyMascot(stage, "pipo")
m.object              // THREE.Group: position/rotate it. Stands on y = 0, faces +z, ~2 units tall
m.setMood("happy", 1200)   // idle | happy | wow | think | sleep | hop; no ms = permanent (base) mood
m.setBase("sleep")    // change the base mood without cutting a temporary one
m.say("Wheek!", 2500) // glass speech bubble pinned above the head (ms 0 = until hush())
m.hush()
m.mouth(0.7)          // 0..1, for singing/talking
m.lookAt(vec3 | "pointer" | null)   // eyes + head follow; null = idle glances
m.use("pipo")         // swap mascot in place with a pop
m.sound()             // the mascot's sfx (chirp / squeak)
m.celebrate()         // happy + sound + star burst: "well done!"
m.shake()             // gentle "not quite" head shake
m.def                 // the 2D registry entry: name, greeting, sound, treat…
m.dispose()
```

Moods: idle breathes, blinks and glances; happy hops with squash & stretch, flaps wings/ears, ^^ eyes, sparkles;
wow widens pupils and double-hops; think tilts, looks up and shows thought dots; sleep closes eyes, breathes slowly, floats Z's; hop is one jump.
New mascot? Register its 2D version as usual, then `Kit.register3D(id, () => rig)` (contract at the top of `kit/mascots3d.js`). Without a 3D model it appears as a round buddy in its colour.

### Treats and props

`Kit.treat(mascotIdOrDef)` → the buddy's favourite food (Pipo 🌽 corn cob, Bollo red bell pepper, anyone else a star), `Kit.corn()`, `Kit.pepper()`, `Kit.star3D(color)`, `Kit.registerTreat(id, factory)`. Each is ~1 unit, centred.

Lots of treats (a jar, a 10 × 10 array, treat rain): `const arr = new Kit.TreatInstances(stage, max)`, `arr.setTreat(id)`, `stage.scene.add(arr.group)`, then `arr.set(i, { x, y, z, s, rx, ry, rz })`, `arr.count = n`, `arr.flush()`. Every part of the treat becomes one InstancedMesh (a corn array is 3 draw calls; big arrays use a low-poly version).

### Materials, environment, text

- `Kit.toon(color, { rim, rimColor, emissive, vertexColors, unique })`: the house style, a soft cel ramp plus a fresnel rim. `Kit.candy(color, emissive, { unique })` glossier; `Kit.flat(color, { opacity, additive, unique })` unlit.
  **Caching rule**: `toon`, `candy` and `flat` return one *shared* material per set of options, so reuse is free, but never change a shared one (`opacity`, `color`, `visible`…): every object using it changes too. To animate a material, ask for your own with `{ unique: true }`.
- `Kit.holo(color, { opacity, swirl })`: animated holographic surface (portals, pads, screens).
- `Kit.label(text, { size, color, bg, outline })`: text/emoji sprite (numbers, icons); `sprite.userData.setText(t)` to change it, as often as you like. It redraws itself when the web font arrives and swaps in a new GPU texture whenever the text changes size, so no need to wait for fonts before building labels.
- `Kit.blobShadow(radius)`: cheap soft contact shadow.
- `Kit.createClouds(scene, opts)`, `Kit.createSparkles(scene, opts)`, `Kit.createSky(scene, opts)`.
- `Kit.Spring`, `Kit.damp`, `Kit.lerp`, `Kit.clamp`, `Kit.ease`, `Kit.frame`/`fitDistance`, `Kit.fitPoints`/`boxPoints`/`ellipsePoints`, `Kit.clampPin`, `Kit.isShown(object)`: pure helpers (unit-tested in `kit/kit.test.js`).

### Glass UI (`kit/ui.css` + `Kit.ui`)

Classes: `kit-hud` (fixed top bar for chips), `kit-glass` (frosted panel), `kit-panel`, `kit-chip` (small pill, 44 px tall), `kit-btn` (+ `primary`, `kit-round`), `kit-card` + `Kit.ui.tilt(el)` (tilts towards the pointer with a glare), `kit-holo-edge` (animated rainbow border), `kit-badge`, `kit-bar` (`Kit.ui.bar(v, max)` → `.set(v, max)`).
Helpers: `Kit.ui.langChip(btn)`, `buddyChip(btn, fallbackId)`, `soundChip(btn)`, `dialog({ icon, title, body, actions: [{ text, href?, onClick?, primary? }] })` → Promise<index> (focus trap, Escape closes), `toast(text, { ms, action })` (drops in under the `.kit-hud`; mark a custom header with `data-kit-hud`), `bubble()`, `fallback(container, href)`.
Kit texts live in `Kit.KIT_DICT` (en, es); `Kit.kt(key)` translates them.

## Design language

Toy-like futurism: things look like soft vinyl toys floating in a bright pastel sky. Rounded everything,
toon shading with a white rim light, holographic swirls for "tech" surfaces (portals, pads), frosted glass
for UI, gentle springs and squash & stretch for every touch, and the buddy always watching and reacting.
Colours come from `shared/base.css` (ink `#26315c`, accent pink, gold) plus each game's catalogue colour.
Motion is calm by default and nearly still with `prefers-reduced-motion`.

## Performance budget

60 fps on a mid laptop, ≥ 30 fps on a cheap tablet. No textures to download (gradients, vertex colours
and tiny canvases only), instancing for repeated things, one mascot ≈ 55 draw calls. The hub renders in
~130 draw calls / ~95k triangles. Check `stage.stats` while developing.
