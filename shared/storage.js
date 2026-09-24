// Per-browser storage. Every read/write is guarded: private windows or blocked
// storage must never break a game. Keys are namespaced "kids.".
const KidsStore = (() => {
  const PREFIX = "kids.";

  function load(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(PREFIX + key));
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {}
  }

  // Each game reports its star total so the hub can show global progress.
  function setProgress(gameId, stars, maxStars) {
    const all = load("progress", {});
    all[gameId] = { stars, max: maxStars };
    save("progress", all);
  }

  function progress() {
    return load("progress", {});
  }

  function totalStars() {
    return Object.values(progress()).reduce(
      (sum, p) => sum + (p.stars || 0),
      0,
    );
  }

  return { load, save, setProgress, progress, totalStars };
})();
