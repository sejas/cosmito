// The analog clock: an SVG face with draggable hands (mouse, touch, pen),
// keyboard sliders on each hand, a "ghost" to show where hands should go and
// smooth animations. Time maths comes from time.js (ClockLogic).
const ClockFace = (() => {
  "use strict";
  const L = ClockLogic;
  const NS = "http://www.w3.org/2000/svg";
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const R = 100; // face radius in SVG units

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // Static face (rim, ticks, numbers, optional minute ring) into an <svg>.
  function drawFace(svg, { minuteRing = false, mini = false } = {}) {
    el("circle", { class: "c-rim", r: R + 12 }, svg);
    el("circle", { class: "c-face", r: R }, svg);
    if (!mini) el("circle", { class: "c-face-ring", r: R - 3 }, svg);
    const ticks = el("g", { class: "c-ticks", "aria-hidden": "true" }, svg);
    for (let i = 0; i < 60; i++) {
      const big = i % 5 === 0;
      if (mini && !big) continue;
      const a = (i * 6 * Math.PI) / 180;
      const r1 = big ? R - 12 : R - 7;
      el(
        "line",
        {
          class: big ? "c-tick big" : "c-tick",
          x1: Math.sin(a) * r1,
          y1: -Math.cos(a) * r1,
          x2: Math.sin(a) * (R - 3),
          y2: -Math.cos(a) * (R - 3),
        },
        ticks,
      );
    }
    const nums = el("g", { class: "c-nums", "aria-hidden": "true" }, svg);
    for (let h = 1; h <= 12; h++) {
      const a = (h * 30 * Math.PI) / 180;
      const r = mini ? R - 30 : R - 32;
      const tx = el(
        "text",
        { class: "c-num", x: Math.sin(a) * r, y: -Math.cos(a) * r + 1 },
        nums,
      );
      tx.textContent = h;
    }
    const ring = el("g", { class: "c-minring", "aria-hidden": "true" }, svg);
    for (let i = 0; i < 12; i++) {
      const a = (i * 30 * Math.PI) / 180;
      const tx = el(
        "text",
        {
          class: "c-min",
          x: Math.sin(a) * (R + 6),
          y: -Math.cos(a) * (R + 6) + 0.5,
        },
        ring,
      );
      tx.textContent = String(i * 5).padStart(2, "0");
    }
    ring.style.display = minuteRing ? "" : "none";
    return ring;
  }

  function drawHand(parent, part, mini) {
    const g = el("g", { class: `hand hand-${part}` }, parent);
    const len = part === "h" ? 52 : 84;
    if (!mini)
      el("line", { class: "hand-hit", x1: 0, y1: 14, x2: 0, y2: -len - 8 }, g);
    el("line", { class: "hand-body", x1: 0, y1: 12, x2: 0, y2: -len }, g);
    if (!mini)
      el(
        "circle",
        { class: "hand-knob", cx: 0, cy: -len + 2, r: part === "h" ? 8 : 7 },
        g,
      );
    return g;
  }

  // A small static clock (answer options, level cards).
  function mini(t) {
    const svg = el("svg", {
      viewBox: "-114 -114 228 228",
      class: "clock mini",
      "aria-hidden": "true",
    });
    drawFace(svg, { mini: true });
    const hh = drawHand(svg, "h", true);
    const mh = drawHand(svg, "m", true);
    el("circle", { class: "c-cap", r: 7 }, svg);
    hh.setAttribute("transform", `rotate(${L.hourAngle(t)})`);
    mh.setAttribute("transform", `rotate(${L.minuteAngle(t)})`);
    return svg;
  }

  class Face {
    // opts: { label(t) → phrase for screen readers, names: {h, m} }
    constructor(container, opts = {}) {
      this.opts = opts;
      this.t = 0;
      this.shown = 0; // float time currently drawn (animations)
      this.step = 60;
      this.liveStep = 5;
      this.interactive = false;
      this.listeners = { change: [], release: [], grab: [] };
      this.anim = 0;

      const svg = el("svg", {
        viewBox: "-114 -114 228 228",
        class: "clock big",
      });
      this.svg = svg;
      this.ringEl = drawFace(svg);
      this.ghost = el("g", { class: "ghost", "aria-hidden": "true" }, svg);
      this.ghostH = drawHand(this.ghost, "h", true);
      this.ghostM = drawHand(this.ghost, "m", true);
      this.ghost.style.display = "none";
      this.hh = drawHand(svg, "h");
      this.mh = drawHand(svg, "m");
      el("circle", { class: "c-cap", r: 8 }, svg);
      el("circle", { class: "c-cap-dot", r: 3 }, svg);
      container.appendChild(svg);

      for (const [g, part] of [
        [this.hh, "h"],
        [this.mh, "m"],
      ]) {
        g.dataset.part = part;
        g.addEventListener("keydown", (e) => this.onKey(e, part));
      }
      svg.addEventListener("pointerdown", (e) => this.onDown(e));
      svg.addEventListener("pointermove", (e) => this.onMove(e));
      svg.addEventListener("pointerup", (e) => this.onUp(e));
      svg.addEventListener("pointercancel", (e) => this.onUp(e));
      svg.addEventListener("lostpointercapture", (e) => this.onUp(e));
      this.setInteractive(false);
      this.draw(0);
    }

    on(name, fn) {
      this.listeners[name].push(fn);
    }
    emit(name) {
      this.listeners[name].forEach((fn) => fn(this.t));
    }

    setStep(step) {
      this.step = step;
      this.liveStep = step === 1 ? 1 : 5;
    }

    setMinuteRing(on) {
      this.ringEl.style.display = on ? "" : "none";
      this.svg.classList.toggle("with-ring", on);
    }

    setInteractive(on) {
      this.interactive = on;
      this.svg.classList.toggle("interactive", on);
      for (const [g, part] of [
        [this.hh, "h"],
        [this.mh, "m"],
      ]) {
        if (on) {
          g.setAttribute("tabindex", "0");
          g.setAttribute("role", "slider");
          g.setAttribute(
            "aria-label",
            this.opts.names ? this.opts.names()[part] : part,
          );
        } else {
          [
            "tabindex",
            "role",
            "aria-label",
            "aria-valuetext",
            "aria-valuenow",
            "aria-valuemin",
            "aria-valuemax",
          ].forEach((a) => g.removeAttribute(a));
        }
      }
      this.svg.setAttribute("role", on ? "group" : "img");
      this.updateAria();
    }

    // Names/labels changed (language switch).
    relabel() {
      this.setInteractive(this.interactive);
    }

    // Screen-reader text. `hidden`: don't reveal the time (reading quizzes).
    setSecret(on) {
      this.secret = on;
      this.updateAria();
    }

    updateAria() {
      const phrase = this.opts.label
        ? this.opts.label(this.t)
        : L.digital(this.t);
      if (this.interactive) {
        this.svg.removeAttribute("aria-label");
        this.hh.setAttribute("aria-valuetext", phrase);
        this.hh.setAttribute("aria-valuenow", L.hourOf(this.t));
        this.hh.setAttribute("aria-valuemin", 1);
        this.hh.setAttribute("aria-valuemax", 12);
        this.mh.setAttribute("aria-valuetext", phrase);
        this.mh.setAttribute("aria-valuenow", L.minuteOf(this.t));
        this.mh.setAttribute("aria-valuemin", 0);
        this.mh.setAttribute("aria-valuemax", 59);
      } else {
        this.svg.setAttribute(
          "aria-label",
          this.secret
            ? this.opts.secretLabel?.() || ""
            : this.opts.shows
              ? this.opts.shows(phrase)
              : phrase,
        );
      }
    }

    // Draw hands for a (possibly fractional) time.
    draw(tf) {
      this.shown = tf;
      const m = ((tf % 60) + 60) % 60;
      const d = ((tf % 720) + 720) % 720;
      this.mh.setAttribute("transform", `rotate(${(m * 6).toFixed(2)})`);
      this.hh.setAttribute("transform", `rotate(${(d * 0.5).toFixed(2)})`);
    }

    // Set the time. animate: glide the hands forwards/backwards the short way.
    set(t, { animate = false, ms = 900 } = {}) {
      cancelAnimationFrame(this.anim);
      const target = L.norm(t);
      const from = this.shown;
      this.t = target;
      this.updateAria();
      if (!animate || reduced()) {
        this.draw(target);
        return Promise.resolve();
      }
      let delta = target - L.norm(from);
      if (delta > 360) delta -= 720;
      if (delta < -360) delta += 720;
      const start = performance.now();
      return new Promise((resolve) => {
        const step = (now) => {
          const k = Math.min(1, (now - start) / ms);
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          this.draw(L.norm(from) + delta * e);
          if (k < 1) this.anim = requestAnimationFrame(step);
          else {
            this.draw(target);
            resolve();
          }
        };
        this.anim = requestAnimationFrame(step);
      });
    }

    showGhost(t) {
      if (t == null) {
        this.ghost.style.display = "none";
        return;
      }
      this.ghostH.setAttribute("transform", `rotate(${L.hourAngle(t)})`);
      this.ghostM.setAttribute("transform", `rotate(${L.minuteAngle(t)})`);
      this.ghost.style.display = "";
    }

    // Change by user action (drag live / buttons / keys).
    change(t) {
      const n = L.norm(t);
      if (n === this.t) return false;
      cancelAnimationFrame(this.anim);
      this.t = n;
      this.draw(n);
      this.updateAria();
      this.emit("change");
      return true;
    }

    nudge(part, dir) {
      if (!this.interactive) return;
      this.emit("grab");
      this.change(L.nudge(this.t, part, dir, part === "h" ? 60 : this.step));
      this.emit("release");
    }

    onKey(e, part) {
      if (!this.interactive) return;
      const dir = {
        ArrowUp: 1,
        ArrowRight: 1,
        ArrowDown: -1,
        ArrowLeft: -1,
        "+": 1,
        "-": -1,
      }[e.key];
      if (!dir) return;
      e.preventDefault();
      e.stopPropagation();
      // At the o'clock level the minute hand turns a whole hour per key.
      this.nudge(part === "m" && this.step === 60 ? "h" : part, dir);
    }

    angleOf(e) {
      const r = this.svg.getBoundingClientRect();
      return L.pointAngle(
        e.clientX - (r.left + r.width / 2),
        e.clientY - (r.top + r.height / 2),
      );
    }

    onDown(e) {
      if (!this.interactive || (e.pointerType === "mouse" && e.button !== 0))
        return;
      const r = this.svg.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      // Ignore touches on the very centre (no direction there).
      if (Math.hypot(dx, dy) < r.width * 0.06) return;
      // Face units: the SVG spans 228 units (face radius 100).
      const radius = (Math.hypot(dx, dy) / r.width) * 228;
      const part = L.pickHand(this.t, this.angleOf(e), radius);
      this.drag = { id: e.pointerId, part };
      try {
        this.svg.setPointerCapture(e.pointerId);
      } catch {}
      e.preventDefault();
      this.svg.classList.add("dragging", `drag-${part}`);
      (part === "h" ? this.hh : this.mh).focus?.({ preventScroll: true });
      this.emit("grab");
      this.onMove(e);
    }

    onMove(e) {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      const a = this.angleOf(e);
      const t =
        this.drag.part === "h"
          ? L.dragHour(this.t, a)
          : L.dragMinute(this.t, a, this.liveStep);
      this.change(t);
    }

    onUp(e) {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      this.drag = null;
      this.svg.classList.remove("dragging", "drag-h", "drag-m");
      const snapped = L.snap(this.t, this.step);
      if (snapped !== this.t) {
        this.t = snapped;
        this.updateAria();
        this.set(snapped, { animate: true, ms: 260 });
        this.emit("change");
      }
      this.emit("release");
    }
  }

  return { create: (container, opts) => new Face(container, opts), mini };
})();
