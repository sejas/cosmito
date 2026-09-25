// Glass UI: HTML/CSS controls that float over the 3D canvas (styles in
// ui.css). Real HTML means real focus, screen-reader labels and crisp text.
import { kt } from "./i18n.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const tap = () => window.KidsAudio?.sfx("tap");

export function el(tag, className = "", text = "") {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

// Language chip (cycles KidsI18n languages).
export function langChip(button) {
  window.KidsI18n.mountPicker(button);
  const label = () => button.setAttribute("aria-label", kt("langLabel"));
  window.KidsI18n.onChange(label);
  label();
  button.addEventListener("click", tap);
  return button;
}

// Buddy chip (cycles mascots; every Kit mascot listening swaps itself).
export function buddyChip(button, fallbackId = "pipo") {
  window.Mascots.mountPicker(button, fallbackId);
  const label = () =>
    button.setAttribute(
      "aria-label",
      `${kt("buddyLabel")}: ${button.textContent}`,
    );
  window.Mascots.onBuddyChange(label);
  window.KidsI18n.onChange(label);
  label();
  button.addEventListener("click", tap);
  return button;
}

// Sound chip (mute state shared with the 2D games).
export function soundChip(button) {
  const render = () => {
    button.textContent = window.KidsAudio.isMuted()
      ? kt("soundOff")
      : kt("soundOn");
    button.setAttribute("aria-pressed", String(!window.KidsAudio.isMuted()));
    button.setAttribute("aria-label", kt("soundLabel"));
  };
  button.addEventListener("click", async () => {
    await window.KidsAudio.ensure();
    window.KidsAudio.setMuted(!window.KidsAudio.isMuted());
    tap();
    render();
  });
  window.KidsI18n.onChange(render);
  render();
  return button;
}

// Pointer-driven 3D tilt with a moving glare, for .kit-card elements.
export function tilt(card, { max = 12 } = {}) {
  if (reduced()) return card;
  card.classList.add("kit-tilt");
  const move = (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.setProperty("--rx", `${-y * max}deg`);
    card.style.setProperty("--ry", `${x * max}deg`);
    card.style.setProperty("--gx", `${(x + 0.5) * 100}%`);
    card.style.setProperty("--gy", `${(y + 0.5) * 100}%`);
  };
  const leave = () => {
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
  };
  card.addEventListener("pointermove", move);
  card.addEventListener("pointerleave", leave);
  return card;
}

// Speech bubble element (the mascot pins it above its head).
export function bubble() {
  const b = el("div", "kit-bubble");
  b.setAttribute("role", "status");
  b.setAttribute("aria-live", "polite");
  return b;
}

// Progress bar: <div class="kit-bar"><div></div></div>
export function bar(value, max) {
  const b = el("div", "kit-bar");
  const fill = el("div");
  b.appendChild(fill);
  b.set = (v, m = max) => {
    fill.style.width = `${m ? Math.min(100, (v / m) * 100) : 0}%`;
    b.setAttribute("role", "progressbar");
    b.setAttribute("aria-valuemin", "0");
    b.setAttribute("aria-valuemax", String(m));
    b.setAttribute("aria-valuenow", String(v));
  };
  b.set(value, max);
  return b;
}

// Modal glass dialog. actions: [{ text, href?, onClick?, primary? }].
// Resolves with the index of the chosen action (or -1 when dismissed).
export function dialog({
  title,
  body = "",
  icon = "",
  actions = [{ text: kt("close") }],
}) {
  return new Promise((resolve) => {
    const back = el("div", "kit-backdrop");
    const box = el("div", "kit-glass kit-dialog");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    if (icon) box.appendChild(el("div", "kit-dialog-icon", icon));
    const h = el("h2", "kit-dialog-title", title);
    h.id = `kit-dlg-${Date.now()}`;
    box.setAttribute("aria-labelledby", h.id);
    box.appendChild(h);
    if (body) box.appendChild(el("p", "kit-dialog-body", body));
    const row = el("div", "kit-dialog-actions");
    const prev = document.activeElement;
    const close = (i) => {
      back.classList.remove("show");
      setTimeout(() => back.remove(), 220);
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
      resolve(i);
    };
    actions.forEach((a, i) => {
      const b = el(
        a.href ? "a" : "button",
        `kit-btn${a.primary ? " primary" : ""}`,
        a.text,
      );
      if (a.href) b.href = a.href;
      else b.type = "button";
      b.addEventListener("click", () => {
        tap();
        a.onClick?.();
        close(i);
      });
      row.appendChild(b);
    });
    box.appendChild(row);
    back.appendChild(box);
    back.addEventListener("click", (e) => e.target === back && close(-1));
    const onKey = (e) => {
      if (e.key === "Escape") close(-1);
      if (e.key === "Tab") {
        const f = [...box.querySelectorAll("a,button")];
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) (f.at(-1).focus(), e.preventDefault());
        else if (!e.shiftKey && i === f.length - 1)
          (f[0].focus(), e.preventDefault());
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add("show"));
    (row.querySelector(".primary") || row.firstChild)?.focus();
  });
}

// Small glass toast at the bottom. Returns a function that hides it.
export function toast(text, { ms = 5000, action } = {}) {
  const t = el("div", "kit-glass kit-toast");
  t.setAttribute("role", "status");
  t.appendChild(el("span", "", text));
  if (action) {
    const a = el(action.href ? "a" : "button", "kit-chip", action.text);
    if (action.href) a.href = action.href;
    else a.addEventListener("click", action.onClick);
    t.appendChild(a);
  }
  const x = el("button", "kit-chip kit-toast-x", "✕");
  x.type = "button";
  x.setAttribute("aria-label", kt("close"));
  t.appendChild(x);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  const hide = () => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 300);
  };
  x.addEventListener("click", hide);
  if (ms) setTimeout(hide, ms);
  return hide;
}

// Full-page "no 3D here" screen with a link to the 2D version of this page.
export function fallback(container, href) {
  document.documentElement.classList.add("kit-no3d");
  const box = el("div", "kit-glass kit-fallback");
  box.setAttribute("role", "alert");
  box.appendChild(el("div", "kit-dialog-icon", "🛸"));
  const h = el("h1", "kit-dialog-title");
  const p = el("p", "kit-dialog-body");
  const a = el("a", "kit-btn primary");
  a.href = href;
  box.append(h, p, a);
  const render = () => {
    h.textContent = kt("noWebglTitle");
    p.textContent = kt("noWebglBody");
    a.textContent = kt("playClassic");
  };
  render();
  window.KidsI18n?.onChange(render);
  (container || document.body).appendChild(box);
  return box;
}
