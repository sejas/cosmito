// Mascot framework. Each mascot registers an SVG that follows one contract so
// every mood works for every mascot (see CONTRIBUTING.md → "Add a mascot"):
//
//   <svg class="mascot">            root; breathes while idle
//     .eyes-open  (with .pupil, .lid)   default eyes; .lid blinks
//     .eyes-happy                  ^^ eyes for "happy"
//     .eyes-closed                 closed eyes for "sleep"
//     .mouth                       scaled vertically by --mouth (0..1): talking/singing
//     .jaw        (optional)       moved down by --mouth
//     .limb.l / .limb.r            wings/paws: flap in "happy"
//     .sparkles / .zzz / .float    decorations shown by moods
//
// Moods: idle, happy, wow, think, sleep, hop.
//
// Drawing rules (moods animate these with CSS `transform`, which replaces any
// SVG transform attribute on the same element):
//   - never put a transform attribute on .float/.limb/.mouth/.jaw/.lid/.pupil —
//     wrap the shapes in an inner <g transform="…"> instead;
//   - .mouth scales from its top edge, so draw it hanging down from there;
//   - .limb flaps ±35° around 90%/10% 20% (tuned for wings) — override pivots
//     and angles in the mascot's `css`, scoped to .mascot-<id>;
//   - put .float decorations top-left and .zzz top-right so they don't overlap.
//
// Any game can be played with any mascot: the player's chosen "buddy" is global
// (like the language). Games never hard-code a mascot; they ask for
// Mascots.buddy(defaultId) and use the def's name, sound and treat.
const Mascots = (() => {
  const registry = {};
  const buddyListeners = [];

  // def: {
  //   id, emoji, color, svg, css?,
  //   name: {en, es}, about: {en, es}, greeting: {en: [...], es: [...]},
  //   sound: KidsAudio.sfx name ("chirp", "squeak"…),
  //   treat: { icon: emoji or image URL, name: {en: {one, many}, es: {one, many}} }
  //          — the mascot's favourite food; games use it as the reward.
  // }
  function register(def) {
    registry[def.id] = def;
    if (def.css) {
      const style = document.createElement("style");
      style.textContent = def.css;
      document.head.appendChild(style);
    }
  }

  // The player's buddy, or the game's own mascot if none was chosen yet.
  function buddy(fallbackId = "pipo") {
    const id = KidsStore.load("buddy", null);
    return registry[id]
      ? id
      : registry[fallbackId]
        ? fallbackId
        : Object.keys(registry)[0];
  }

  function setBuddy(id) {
    if (!registry[id]) return;
    KidsStore.save("buddy", id);
    buddyListeners.forEach((fn) => fn(id));
  }

  // A chip that cycles through the mascots and shows the current buddy.
  function mountPicker(button, fallbackId) {
    const render = () => {
      const def = registry[buddy(fallbackId)];
      button.textContent = `${def.emoji} ${KidsI18n.pickLang(def.name)}`;
    };
    button.addEventListener("click", () => {
      const ids = Object.keys(registry);
      setBuddy(ids[(ids.indexOf(buddy(fallbackId)) + 1) % ids.length]);
    });
    buddyListeners.push(render);
    KidsI18n.onChange(render);
    render();
  }

  // Used when a mascot doesn't define its own treat.
  const DEFAULT_TREAT = {
    icon: "⭐",
    name: { en: { one: "star", many: "stars" }, es: { one: "estrella", many: "estrellas" } },
  };
  const treatOf = (def) => def.treat || DEFAULT_TREAT;

  // Treat helpers: the icon may be an emoji or an image URL.
  const isImage = (icon) => /\.(svg|png|webp)$/.test(icon);

  function treatEl(def, className = "treat") {
    const icon = treatOf(def).icon;
    const el = document.createElement(isImage(icon) ? "img" : "span");
    el.className = className;
    if (isImage(icon)) {
      el.src = icon;
      el.alt = "";
    } else {
      el.textContent = icon;
    }
    return el;
  }

  // "red pepper" / "red peppers" in the current language.
  function treatName(def, count = 2) {
    const n = KidsI18n.pickLang(treatOf(def).name);
    return count === 1 ? n.one : n.many;
  }

  // Resolve a path relative to shared/ (for treat icons), wherever the page is.
  const SHARED = new URL(".", document.currentScript.src).href;
  const asset = (path) => new URL(path, SHARED).href;

  class Mascot {
    constructor(wrap, bubble, id = "pipo") {
      this.wrap = wrap;
      this.bubble = bubble;
      this.mood = "idle";
      this.base = "idle";
      this.moodTimer = 0;
      this.sayTimer = 0;
      wrap.classList.add("mascot-wrap", "mood-idle");
      this.use(id);
    }

    // Swap to another mascot in place, keeping mood and bubble.
    use(id) {
      const def = registry[id];
      if (!def) throw new Error(`Unknown mascot: ${id}`);
      if (this.def) this.wrap.classList.remove(`mascot-${this.def.id}`);
      this.wrap.querySelector("svg.mascot")?.remove();
      this.def = def;
      this.wrap.classList.add(`mascot-${id}`);
      this.wrap.insertAdjacentHTML("afterbegin", def.svg);
    }

    // Permanent mood (ms omitted) or a temporary one that returns to the base mood.
    setMood(mood, ms) {
      clearTimeout(this.moodTimer);
      this.moodTimer = 0;
      if (!ms) this.base = mood;
      this.apply(mood);
      if (ms) this.moodTimer = setTimeout(() => this.apply(this.base), ms);
    }

    // Change the base mood without interrupting a temporary one.
    setBase(mood) {
      if (this.base === mood) return;
      this.base = mood;
      if (!this.moodTimer || this.mood === this.base) this.apply(mood);
    }

    apply(mood) {
      if (mood === this.mood) return;
      this.wrap.classList.remove(`mood-${this.mood}`);
      this.wrap.classList.add(`mood-${mood}`);
      this.mood = mood;
      if (mood === this.base) this.moodTimer = 0;
    }

    // Speech bubble. ms = 0 keeps it until the next say()/hush().
    say(text, ms = 2600) {
      if (!this.bubble) return;
      clearTimeout(this.sayTimer);
      this.bubble.textContent = text;
      this.bubble.classList.add("show");
      if (ms) this.sayTimer = setTimeout(() => this.hush(), ms);
    }

    hush() {
      this.bubble?.classList.remove("show");
    }

    // 0..1 — how open the mouth is.
    mouth(v) {
      this.wrap.style.setProperty("--mouth", v.toFixed(2));
    }

    // The mascot's own sound effect.
    sound() {
      window.KidsAudio?.sfx(this.def.sound || "chirp");
    }
  }

  return {
    register,
    get: (id) => registry[id],
    list: () => Object.values(registry),
    create: (wrap, bubble, id) => new Mascot(wrap, bubble, id),
    buddy,
    setBuddy,
    onBuddyChange: (fn) => buddyListeners.push(fn),
    mountPicker,
    treatOf,
    treatEl,
    treatName,
    asset,
    Mascot,
  };
})();
