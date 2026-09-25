// Pure hub logic (no three.js, no DOM): portal layout and rank maths.

// Where the portals, the buddy and the camera go for n games and a viewport
// aspect. Wide screens get an arc of portals around the buddy; tall screens a
// two-column path that climbs the island. Returns world-space x/z values.
export function layoutHub(n, aspect) {
  if (aspect >= 1.05) {
    const spread = n <= 1 ? 0 : Math.min(150, 36 * (n - 1));
    const step = n <= 1 ? 1 : (spread * Math.PI) / 180 / (n - 1);
    const R = Math.max(4.2, 2.3 / (step * 0.8));
    const portals = Array.from({ length: n }, (_, i) => {
      const a =
        ((n <= 1 ? 0 : -spread / 2 + (spread * i) / (n - 1)) * Math.PI) / 180;
      return { x: Math.sin(a) * R, z: -Math.cos(a) * R * 0.72 + 0.6 };
    });
    return {
      portals,
      buddy: { x: 0, z: 2.4 },
      view: {
        center: [0, 1.1, 0.3],
        width: 2 * R + 2.6,
        height: 5.6,
        elevation: 24,
      },
      wide: true,
    };
  }
  const rows = Math.ceil(n / 2);
  const gapZ = 2.9;
  const portals = Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / 2);
    const lastAlone = n % 2 === 1 && i === n - 1;
    return { x: lastAlone ? 0 : i % 2 ? 1.75 : -1.75, z: 0.4 - row * gapZ };
  });
  const depth = (rows - 1) * gapZ;
  return {
    portals,
    buddy: { x: 0, z: 2.6 },
    view: {
      center: [0, 1, 1.4 - depth / 2],
      width: 6,
      height: 3.2 + depth * 0.62,
      elevation: 38,
    },
    wide: false,
  };
}

// Rank index and stars needed for the next rank, like the 2D hub.
export function rankFor(have, max, rankCount) {
  if (!max || rankCount < 2) return { rank: 0, toNext: 0, last: true };
  const step = max / (rankCount - 1);
  const rank = Math.min(rankCount - 1, Math.floor(have / step));
  const last = rank === rankCount - 1;
  return { rank, toNext: last ? 0 : Math.ceil(step * (rank + 1)) - have, last };
}
