// Line-art pictures for the paint mode. Every picture is 200×200.
//
// regions: fillable shapes, drawn in order (first = bottom). Each has
//   id, d (SVG path), target (the colour id for "paint by symbol"; "buddy"
//   means the buddy's own colour, resolved by the app) and at [x, y], where
//   the target's symbol is shown while the region is still blank.
// lines: decorations drawn on top that can't be painted (eyes, window bars…).
const ColorPictures = (() => {
  const f = (n) => +n.toFixed(1);
  const rect = (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}z`;
  const ellipse = (cx, cy, rx, ry) =>
    `M${f(cx - rx)} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`;
  const circle = (cx, cy, r) => ellipse(cx, cy, r, r);
  const poly = (...pts) => `M${pts.map((p) => p.join(" ")).join("L")}z`;
  // A petal from the centre (cx, cy) pointing at `deg`, `len` long.
  function petal(cx, cy, deg, len, width) {
    const a = (deg * Math.PI) / 180;
    const [ux, uy] = [Math.cos(a), Math.sin(a)];
    const [px, py] = [-uy * width, ux * width];
    const tip = [cx + ux * len, cy + uy * len];
    const mid = [cx + ux * len * 0.55, cy + uy * len * 0.55];
    return `M${f(cx)} ${f(cy)}Q${f(mid[0] + px)} ${f(mid[1] + py)} ${f(tip[0])} ${f(tip[1])}Q${f(mid[0] - px)} ${f(mid[1] - py)} ${f(cx)} ${f(cy)}z`;
  }
  const petalAt = (cx, cy, deg, dist) => {
    const a = (deg * Math.PI) / 180;
    return [f(cx + Math.cos(a) * dist), f(cy + Math.sin(a) * dist)];
  };

  const INK = "#26315c";
  const PICTURES = [
    {
      id: "house",
      icon: "🏠",
      regions: [
        { id: "sky", d: rect(0, 0, 200, 200), target: "blue", at: [100, 22] },
        { id: "sun", d: circle(34, 34, 18), target: "orange", at: [34, 34] },
        {
          id: "grass",
          d: "M0 156Q100 138 200 156V200H0z",
          target: "green",
          at: [30, 182],
        },
        {
          id: "chimney",
          d: rect(128, 46, 16, 36),
          target: "grey",
          at: [136, 58],
        },
        { id: "wall", d: rect(46, 96, 108, 74), target: "pink", at: [75, 156] },
        {
          id: "roof",
          d: poly([34, 100], [100, 44], [166, 100]),
          target: "red",
          at: [100, 82],
        },
        {
          id: "window",
          d: rect(58, 108, 34, 30),
          target: "yellow",
          at: [67, 117],
        },
        {
          id: "door",
          d: "M112 170V132a15 15 0 0 1 30 0V170z",
          target: "brown",
          at: [127, 150],
        },
      ],
      lines: [
        { d: "M75 108v30M58 123h34", stroke: 3 },
        { d: circle(136, 152, 2.5), fill: INK },
      ],
    },
    {
      id: "flower",
      icon: "🌷",
      regions: [
        { id: "sky", d: rect(0, 0, 200, 200), target: "blue", at: [30, 30] },
        { id: "stem", d: rect(96, 74, 8, 72), target: "green", at: [100, 132] },
        {
          id: "leafL",
          d: "M98 124Q70 96 52 110Q70 134 98 128z",
          target: "green",
          at: [72, 116],
        },
        {
          id: "leafR",
          d: "M102 110Q130 82 148 96Q130 120 102 114z",
          target: "green",
          at: [128, 102],
        },
        ...[0, 1, 2, 3, 4, 5].map((i) => ({
          id: `petal${i}`,
          d: petal(100, 62, -90 + i * 60, 44, 17),
          target: i % 2 ? "purple" : "red",
          at: petalAt(100, 62, -90 + i * 60, 28),
        })),
        {
          id: "middle",
          d: circle(100, 62, 13),
          target: "yellow",
          at: [100, 62],
        },
        {
          id: "rim",
          d: rect(62, 144, 76, 14),
          target: "brown",
          at: [100, 151],
        },
        {
          id: "pot",
          d: poly([68, 158], [132, 158], [122, 196], [78, 196]),
          target: "orange",
          at: [100, 177],
        },
      ],
      lines: [],
    },
    {
      id: "fish",
      icon: "🐠",
      regions: [
        { id: "water", d: rect(0, 0, 200, 200), target: "blue", at: [100, 24] },
        {
          id: "sand",
          d: "M0 176Q60 164 110 174T200 170V200H0z",
          target: "yellow",
          at: [100, 188],
        },
        {
          id: "weedL",
          d: "M18 178Q4 150 20 128Q34 108 22 84Q42 110 32 134Q24 154 34 178z",
          target: "green",
          at: [24, 150],
        },
        {
          id: "weedR",
          d: "M168 176Q160 150 176 132Q188 118 182 100Q198 120 190 140Q180 156 184 176z",
          target: "green",
          at: [178, 150],
        },
        {
          id: "tail",
          d: poly([140, 100], [182, 68], [174, 100], [182, 132]),
          target: "red",
          at: [168, 100],
        },
        { id: "fin", d: "M70 70Q96 38 128 70z", target: "red", at: [100, 62] },
        {
          id: "body",
          d: ellipse(96, 100, 56, 36),
          target: "orange",
          at: [124, 108],
        },
        {
          id: "stripe",
          d: "M92 65Q80 100 92 135Q110 100 104 64z",
          target: "yellow",
          at: [96, 100],
        },
      ],
      lines: [
        { d: circle(62, 94, 8), fill: "#fff" },
        { d: circle(60, 94, 4), fill: INK },
        { d: "M44 112q8 5 14 0", stroke: 3 },
        {
          d: circle(40, 60, 6) + circle(30, 38, 4) + circle(38, 22, 3),
          stroke: 2.5,
        },
      ],
    },
    {
      id: "rocket",
      icon: "🚀",
      regions: [
        { id: "sky", d: rect(0, 0, 200, 200), target: "black", at: [150, 32] },
        { id: "moon", d: circle(40, 40, 20), target: "yellow", at: [40, 40] },
        {
          id: "planet",
          d: circle(164, 158, 22),
          target: "green",
          at: [164, 158],
        },
        {
          id: "flame",
          d: "M80 150Q100 214 120 150z",
          target: "orange",
          at: [89, 158],
        },
        {
          id: "flameIn",
          d: "M89 150Q100 184 111 150z",
          target: "yellow",
          at: [100, 158],
        },
        {
          id: "finL",
          d: poly([76, 112], [54, 146], [54, 160], [76, 150]),
          target: "red",
          at: [63, 146],
        },
        {
          id: "finR",
          d: poly([124, 112], [146, 146], [146, 160], [124, 150]),
          target: "red",
          at: [137, 146],
        },
        { id: "body", d: rect(76, 70, 48, 80), target: "grey", at: [100, 134] },
        {
          id: "nose",
          d: "M100 30Q120 44 124 70H76Q80 44 100 30z",
          target: "red",
          at: [100, 58],
        },
        { id: "window", d: circle(100, 98, 13), target: "blue", at: [100, 98] },
      ],
      lines: [
        { d: "M138 170q26 -4 48 -18M142 176q24 -6 44 -20", stroke: 2.5 },
        {
          d: "M22 150l4 -8 4 8 -8 -5h8zM170 80l3 -6 3 6 -6 -4h6zM60 90l3 -6 3 6 -6 -4h6z",
          fill: "#fff",
        },
      ],
    },
    {
      id: "friend",
      icon: "🐾",
      regions: [
        { id: "sky", d: rect(0, 0, 200, 200), target: "blue", at: [26, 26] },
        {
          id: "grass",
          d: "M0 168Q100 150 200 168V200H0z",
          target: "green",
          at: [26, 186],
        },
        {
          id: "earL",
          d: ellipse(58, 56, 18, 26),
          target: "buddy",
          at: [56, 50],
        },
        {
          id: "earR",
          d: ellipse(142, 56, 18, 26),
          target: "buddy",
          at: [144, 50],
        },
        { id: "body", d: circle(100, 106, 62), target: "buddy", at: [60, 110] },
        {
          id: "belly",
          d: ellipse(100, 132, 34, 28),
          target: "pink",
          at: [100, 140],
        },
        {
          id: "footL",
          d: ellipse(76, 172, 20, 11),
          target: "orange",
          at: [76, 172],
        },
        {
          id: "footR",
          d: ellipse(124, 172, 20, 11),
          target: "orange",
          at: [124, 172],
        },
        {
          id: "nose",
          d: "M90 96H110L100 110z",
          target: "orange",
          at: [100, 101],
        },
      ],
      lines: [
        { d: circle(80, 82, 8) + circle(120, 82, 8), fill: INK },
        { d: circle(83, 79, 2.6) + circle(123, 79, 2.6), fill: "#fff" },
      ],
    },
  ];

  // Resolve a region's target colour: "buddy" is the buddy's own colour (a
  // named colour id). In a picture with the buddy, any other region that
  // would get the same colour moves to another one so the buddy stands out.
  function targetOf(picture, region, buddyColor) {
    if (region.target === "buddy") return buddyColor;
    const hasBuddy = picture.regions.some((r) => r.target === "buddy");
    if (!hasBuddy || region.target !== buddyColor) return region.target;
    return buddyColor === "orange" ? "red" : buddyColor === "pink" ? "purple" : "orange";
  }

  // The colours a picture needs, in palette order.
  function colorsOf(picture, buddyColor, order) {
    const set = new Set(picture.regions.map((r) => targetOf(picture, r, buddyColor)));
    return order.filter((id) => set.has(id));
  }

  return { PICTURES, INK, targetOf, colorsOf };
})();

if (typeof module !== "undefined") module.exports = ColorPictures;
