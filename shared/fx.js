// Celebration effects: full-screen confetti and emoji bursts at a point.
const KidsFx = (() => {
  const COLORS = [
    "#ff6b6b",
    "#ffa94d",
    "#ffd43b",
    "#51cf66",
    "#4dabf7",
    "#9775fa",
    "#f783ac",
  ];
  // Absolute URL of the shared red-pepper icon, whatever page loads this script.
  const PEPPER = new URL("icons/pepper.svg", document.currentScript.src).href;
  const reduced = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function confetti(duration = 4500) {
    if (reduced()) return;
    const c = document.createElement("canvas");
    c.className = "kids-confetti";
    document.body.appendChild(c);
    const cx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bits = Array.from({ length: 140 }, () => ({
      x: Math.random() * innerWidth,
      y: -20 - Math.random() * innerHeight * 0.6,
      vy: 120 + Math.random() * 160,
      vx: -40 + Math.random() * 80,
      r: Math.random() * Math.PI,
      vr: -4 + Math.random() * 8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      w: 8 + Math.random() * 8,
    }));
    const t0 = performance.now();
    let last = t0;
    const step = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      cx.clearRect(0, 0, innerWidth, innerHeight);
      for (const b of bits) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.r += b.vr * dt;
        cx.save();
        cx.translate(b.x, b.y);
        cx.rotate(b.r);
        cx.fillStyle = b.color;
        cx.fillRect(-b.w / 2, -b.w / 4, b.w, b.w / 2);
        cx.restore();
      }
      if (now - t0 < duration && c.isConnected) requestAnimationFrame(step);
      else c.remove();
    };
    requestAnimationFrame(step);
  }

  // Emoji burst at viewport coordinates (e.g. the centre of a clicked button).
  function burst(x, y, chars = ["⭐", "✨", "🌟"], count = 12) {
    if (reduced()) return;
    for (let i = 0; i < count; i++) {
      // Items are emoji/text, or image URLs (e.g. KidsFx.PEPPER).
      const item = chars[i % chars.length];
      const isImg = /\.(svg|png|webp)$/.test(item);
      const s = document.createElement(isImg ? "img" : "span");
      s.className = "kids-burst";
      if (isImg) {
        s.src = item;
        s.alt = "";
      } else {
        s.textContent = item;
      }
      const a = Math.random() * Math.PI * 2;
      const d = 60 + Math.random() * 90;
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      s.style.setProperty("--dx", `${Math.cos(a) * d}px`);
      s.style.setProperty("--dy", `${Math.sin(a) * d - 40}px`);
      document.body.appendChild(s);
      s.addEventListener("animationend", () => s.remove());
    }
  }

  function burstFrom(el, chars, count) {
    const r = el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, chars, count);
  }

  return { confetti, burst, burstFrom, COLORS, PEPPER };
})();
