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
];
