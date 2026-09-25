// The game catalogue shown on the hub. Add your game here (see CONTRIBUTING.md).
// maxStars must match what the game passes to KidsStore.setProgress().
// mascot is the game's default buddy; any mascot can play any game, so titles
// and descriptions are functions of the buddy's name and treat.
const GAMES = [
  {
    id: "sing",
    href: "games/sing/",
    emoji: "🎤",
    mascot: "pipo",
    color: "#ffd23f",
    maxStars: 15,
    title: { en: (name) => `Sing with ${name}`, es: (name) => `Canta con ${name}` },
    about: {
      en: "Sing the notes and match the melody!",
      es: "¡Canta las notas y sigue la melodía!",
    },
    skills: { en: "Music · Pitch", es: "Música · Afinación" },
  },
  {
    id: "times-tables",
    href: "games/times-tables/",
    emoji: "🔢",
    mascot: "bollo",
    color: "#e7a86b",
    maxStars: 30,
    title: {
      en: (name) => `Times Tables with ${name}`,
      es: (name) => `Las tablas con ${name}`,
    },
    about: {
      en: (name, treats) => `Feed ${name} ${treats} by learning your times tables!`,
      es: (name, treats) => `¡Dale ${treats} a ${name} aprendiendo las tablas!`,
    },
    skills: { en: "Maths · Multiplication", es: "Mates · Multiplicar" },
  },
  {
    id: "code",
    href: "games/code/",
    emoji: "🧩",
    mascot: "pipo",
    color: "#6cc4ff",
    maxStars: 84,
    title: { en: (name) => `Code with ${name}`, es: (name) => `Programa con ${name}` },
    about: {
      en: (name, treats) => `Guide ${name} to the ${treats} with arrows, loops and magic pads!`,
      es: (name, treats) =>
        `¡Lleva a ${name} hasta sus ${treats} con flechas, bucles y baldosas mágicas!`,
    },
    skills: { en: "Coding · Logic", es: "Programación · Lógica" },
  },
  {
    id: "colors",
    href: "games/colors/",
    emoji: "🎨",
    mascot: "pipo",
    color: "#ff8c1a",
    maxStars: 33,
    title: {
      en: (name) => `Color Lab with ${name}`,
      es: (name) => `Laboratorio de colores con ${name}`,
    },
    about: {
      en: "Learn colour names, mix paints and paint pictures!",
      es: "¡Aprende los colores, mezcla pinturas y pinta dibujos!",
    },
    skills: { en: "Colours · Mixing", es: "Colores · Mezclas" },
  },
  {
    id: "words",
    href: "games/words/",
    emoji: "📚",
    mascot: "pipo",
    color: "#8fd3ff",
    maxStars: 96,
    title: { en: (name) => `Words with ${name}`, es: (name) => `Palabras con ${name}` },
    about: {
      en: (name) => `Learn words in English and Spanish with ${name}: listen, read, spell and match!`,
      es: (name) => `¡Aprende palabras en español e inglés con ${name}: escucha, lee, escribe y empareja!`,
    },
    skills: { en: "Vocabulary · English & Spanish", es: "Vocabulario · Español e inglés" },
  },
  {
    id: "clock",
    href: "games/clock/",
    emoji: "🕐",
    mascot: "bollo",
    color: "#b197fc",
    maxStars: 60,
    title: { en: (name) => `Tell the Time with ${name}`, es: (name) => `La hora con ${name}` },
    about: {
      en: (name) => `Read the clock, move the hands and plan ${name}'s busy day!`,
      es: (name) => `¡Lee el reloj, mueve las agujas y organiza el día de ${name}!`,
    },
    skills: { en: "Time · Clocks", es: "La hora · Relojes" },
  },
];

// Ranks for the stars collected across all games. Shared by both hubs (the 2D
// hub/hub.js and the 3D 3d/hub/hub3d.js), which spread HUB_RANKS[lang] into
// their dictionaries (keys: ranks, next, maxed) and call hubRank().
const HUB_RANKS = {
  en: {
    ranks: [
      "New Explorer 🧭",
      "Curious Cub 🐾",
      "Bright Spark ✨",
      "Super Learner 🚀",
      "Legend 👑",
    ],
    next: (n, rank) => `${n} more ⭐ to become ${rank}`,
    maxed: "You collected every star! 🏆",
  },
  es: {
    ranks: [
      "Explorador novato 🧭",
      "Cachorro curioso 🐾",
      "Chispa brillante ✨",
      "Súper aprendiz 🚀",
      "Leyenda 👑",
    ],
    next: (n, rank) => `${n} ⭐ más para ser ${rank}`,
    maxed: "¡Tienes todas las estrellas! 🏆",
  },
};

// Rank index for `have` of `max` stars with `rankCount` ranks, and the stars
// still needed for the next one: { rank, toNext, last }.
function hubRank(have, max, rankCount) {
  if (!max || rankCount < 2) return { rank: 0, toNext: 0, last: true };
  const step = max / (rankCount - 1);
  const rank = Math.min(rankCount - 1, Math.floor(have / step));
  const last = rank === rankCount - 1;
  return { rank, toNext: last ? 0 : Math.ceil(step * (rank + 1)) - have, last };
}

if (typeof module !== "undefined") module.exports = { GAMES, HUB_RANKS, hubRank };
