// Hand-made levels. Map legend: S start, T treat, . grass, # rock, ^ tree,
// ~ water, * gem (collect all before the treat), y / p coloured pads.
// palette: blocks offered ("U","D","L","R","repeat","if-y","if-p").
// optimal: fewest blocks that solve it (3★). solution: a reference program with
// exactly `optimal` blocks, used for hints and checked by engine.test.js.
// start: a pre-built (buggy) program for debugging levels.
// tutor: always show the next block as a hint. tip: i18n key the buddy says first.
const CODE_WORLDS = [
  {
    id: "meadow",
    icon: "🌱",
    color: "#8fdc6a",
    levels: [
      {
        map: ["S..T"],
        palette: ["R"],
        optimal: 3,
        solution: ["R", "R", "R"],
        tutor: true,
        tip: "tipFirst",
      },
      {
        map: ["S#.", ".#.", "..T"],
        palette: ["D", "R"],
        optimal: 4,
        solution: ["D", "D", "R", "R"],
        tip: "tipTwo",
      },
      {
        map: ["S*~", "#.~", "#.T"],
        palette: ["D", "R"],
        optimal: 4,
        solution: ["R", "D", "D", "R"],
        tip: "tipGem",
      },
      {
        map: ["..~T", "..~.", "S..."],
        palette: ["L", "U", "D", "R"],
        optimal: 5,
        solution: ["R", "R", "R", "U", "U"],
        tip: "tipWater",
      },
      {
        map: ["^T*.", "^~~.", "S..."],
        palette: ["L", "U", "D", "R"],
        optimal: 7,
        solution: ["R", "R", "R", "U", "U", "L", "L"],
      },
      {
        map: ["S.^*", ".^..", "*..T"],
        palette: ["L", "U", "D", "R"],
        optimal: 9,
        solution: ["D", "D", "R", "R", "U", "R", "U", "D", "D"],
      },
      {
        map: ["S.^.T", "^.^.^", "^...^"],
        palette: ["L", "U", "D", "R"],
        optimal: 8,
        solution: ["R", "D", "D", "R", "R", "U", "U", "R"],
      },
      {
        map: [".*.~T", ".^.~.", "S^..."],
        palette: ["L", "U", "D", "R"],
        optimal: 10,
        solution: ["U", "U", "R", "R", "D", "D", "R", "R", "U", "U"],
      },
    ],
  },
  {
    id: "river",
    icon: "🔁",
    color: "#6cc4ff",
    levels: [
      {
        map: ["S....T"],
        palette: ["R", "repeat"],
        optimal: 2,
        solution: [{ repeat: 5, body: ["R"] }],
        tutor: true,
        tip: "tipLoop",
      },
      {
        map: ["S.~~~", "~..~~", "~~..~", "~~~.T"],
        palette: ["L", "U", "D", "R", "repeat"],
        optimal: 3,
        solution: [{ repeat: 4, body: ["R", "D"] }],
        tip: "tipLoopTwo",
      },
      {
        map: ["S....", "~~~~.", "~~~~.", "~~~~.", "~~~~T"],
        palette: ["L", "U", "D", "R", "repeat"],
        optimal: 4,
        solution: [
          { repeat: 4, body: ["R"] },
          { repeat: 4, body: ["D"] },
        ],
      },
      {
        map: ["S...", "~~~.", "~~~.", "T..."],
        palette: ["L", "U", "D", "R", "repeat"],
        optimal: 6,
        solution: [
          { repeat: 3, body: ["R"] },
          { repeat: 3, body: ["D"] },
          { repeat: 3, body: ["L"] },
        ],
      },
      {
        map: ["~~~.T", "~~..~", "~..~~", "..~~~", "S~~~~"],
        palette: ["L", "U", "D", "R", "repeat"],
        optimal: 3,
        solution: [{ repeat: 4, body: ["U", "R"] }],
      },
      {
        map: ["S..~~~~", "~~...~~", "~~~~...", "~~~~~~T"],
        palette: ["L", "U", "D", "R", "repeat"],
        optimal: 4,
        solution: [{ repeat: 3, body: ["R", "R", "D"] }],
      },
      {
        map: [".......", "S^*^*^T"],
        palette: ["L", "U", "D", "R", "repeat"],
        optimal: 5,
        solution: [{ repeat: 3, body: ["U", "R", "R", "D"] }],
        tip: "tipHop",
      },
      {
        map: ["S....", "~~~~.", ".*...", ".~~~~", "...*T"],
        palette: ["L", "U", "D", "R", "repeat"],
        optimal: 10,
        solution: [
          { repeat: 4, body: ["R"] },
          "D",
          "D",
          { repeat: 4, body: ["L"] },
          "D",
          "D",
          { repeat: 4, body: ["R"] },
        ],
      },
    ],
  },
  {
    id: "bugs",
    icon: "🐞",
    color: "#c9a0ff",
    levels: [
      {
        map: ["~~~~~", "S...T", "~~~~~"],
        palette: ["L", "U", "D", "R"],
        optimal: 4,
        solution: ["R", "R", "R", "R"],
        start: ["R", "R", "D", "R"],
        tutor: true,
        tip: "tipBug",
      },
      {
        map: ["S.^", "^.^", "^.T"],
        palette: ["L", "U", "D", "R"],
        optimal: 4,
        solution: ["R", "D", "D", "R"],
        start: ["R", "D", "D"],
        tip: "tipMissing",
      },
      {
        map: ["S.~", "^.~", "^.T"],
        palette: ["L", "U", "D", "R"],
        optimal: 4,
        solution: ["R", "D", "D", "R"],
        start: ["R", "R", "D", "D", "R"],
        tip: "tipExtra",
      },
      {
        map: ["~~~~~~~", "S.....T", "~~~~~~~"],
        palette: ["L", "U", "D", "R", "repeat"],
        optimal: 2,
        solution: [{ repeat: 6, body: ["R"] }],
        start: [{ repeat: 4, body: ["R"] }],
        tip: "tipCount",
      },
      {
        map: ["S.~~", "~..~", "~~..", "~~~T"],
        palette: ["L", "U", "D", "R", "repeat"],
        optimal: 3,
        solution: [{ repeat: 3, body: ["R", "D"] }],
        start: [{ repeat: 3, body: ["D", "R"] }],
      },
      {
        map: ["S...", "~~~.", "T~~.", "*..."],
        palette: ["L", "U", "D", "R", "repeat"],
        optimal: 7,
        solution: [
          { repeat: 3, body: ["R"] },
          { repeat: 3, body: ["D"] },
          { repeat: 3, body: ["L"] },
          "U",
        ],
        start: [
          { repeat: 3, body: ["R"] },
          { repeat: 2, body: ["D"] },
          { repeat: 3, body: ["L"] },
          "D",
        ],
        tip: "tipTwoBugs",
      },
    ],
  },
  {
    id: "magic",
    icon: "✨",
    color: "#ff9fd0",
    levels: [
      {
        map: ["S.y^^", "^^..T"],
        palette: ["L", "U", "D", "R", "repeat", "if-y"],
        optimal: 4,
        solution: [{ repeat: 4, body: ["R", { if: "y", body: ["D"] }] }],
        tutor: true,
        tip: "tipIf",
      },
      {
        map: ["S.y^^^^", "^^..y^^", "^^^^..T"],
        palette: ["L", "U", "D", "R", "repeat", "if-y"],
        optimal: 4,
        solution: [{ repeat: 6, body: ["R", { if: "y", body: ["D"] }] }],
      },
      {
        map: ["S^^", "y.^", "^.^", "^y.", "^^T"],
        palette: ["L", "U", "D", "R", "repeat", "if-y"],
        optimal: 4,
        solution: [{ repeat: 4, body: ["D", { if: "y", body: ["R"] }] }],
      },
      {
        map: ["^^^^..T", "Sy^.p^^", "^..p^^^"],
        palette: ["L", "U", "D", "R", "repeat", "if-y", "if-p"],
        optimal: 6,
        solution: [
          {
            repeat: 6,
            body: ["R", { if: "y", body: ["D"] }, { if: "p", body: ["U"] }],
          },
        ],
        tip: "tipTwoColours",
      },
      {
        map: ["^^S^^", "^^y.^", "^^^*^", "^^.p^", "^.p^^", "^T^^^"],
        palette: ["L", "U", "D", "R", "repeat", "if-y", "if-p"],
        optimal: 6,
        solution: [
          {
            repeat: 5,
            body: ["D", { if: "y", body: ["R"] }, { if: "p", body: ["L"] }],
          },
        ],
      },
      {
        map: ["^^.*y^^", "^.p~.y^", "Sp~~~.T"],
        palette: ["L", "U", "D", "R", "repeat", "if-y", "if-p"],
        optimal: 6,
        solution: [
          {
            repeat: 6,
            body: ["R", { if: "y", body: ["D"] }, { if: "p", body: ["U"] }],
          },
        ],
      },
    ],
  },
];

// Flat list with ids like "1-3" (world-level).
const CODE_LEVELS = CODE_WORLDS.flatMap((w, wi) =>
  w.levels.map((l, li) => ({
    ...l,
    id: `${wi + 1}-${li + 1}`,
    world: wi,
    num: li + 1,
  })),
);

if (typeof module !== "undefined")
  module.exports = { CODE_WORLDS, CODE_LEVELS };
