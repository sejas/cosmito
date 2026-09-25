// Pure hub logic (no three.js, no DOM): portal layout. Rank maths and names
// are shared with the 2D hub: hubRank / HUB_RANKS in hub/games.js.

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
      buddy: { x: 0, z: 2.9 },
      view: {
        center: [0, 1.1, 0.3],
        width: Math.max(2 * R + 2.6, 16.5),
        height: 6.4,
        elevation: 32,
      },
      wide: true,
    };
  }
  // phones in portrait: two columns (bigger portals); tablets: three
  const cols = n > 4 && aspect >= 0.62 ? 3 : 2;
  const rows = Math.ceil(n / cols);
  const gapX = cols === 3 ? 2.15 : 2.8;
  const gapZ = 3.6;
  const portals = Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const col = i % cols;
    return { x: (col - (inRow - 1) / 2) * gapX, z: 0.2 - row * gapZ };
  });
  const depth = (rows - 1) * gapZ;
  return {
    portals,
    buddy: { x: 0, z: 3 },
    view: {
      center: [0, 1.3, 1.5 - depth / 2],
      width: cols * gapX + 0.9,
      height: 5.8 + depth * 0.78, // + room for the labels above the back row
      elevation: 50,
    },
    wide: false,
  };
}
