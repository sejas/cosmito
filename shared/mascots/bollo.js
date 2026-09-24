// Bollo — a fluffy brown-and-white guinea pig who loves red peppers and numbers.
// Ears are the .limb pair (they wiggle in "happy"); both eyes sit on brown fur.
Mascots.register({
  id: "bollo",
  name: { en: "Bollo", es: "Bollo" },
  emoji: "🐹",
  color: "#a8652f",
  about: {
    en: "A fluffy guinea pig who loves red peppers and numbers",
    es: "Un cobaya achuchable al que le encantan los pimientos rojos y los números",
  },
  sound: "squeak",
  treat: {
    icon: Mascots.asset("icons/pepper.svg"),
    name: {
      en: { one: "red pepper", many: "red peppers" },
      es: { one: "pimiento rojo", many: "pimientos rojos" },
    },
  },
  greeting: {
    en: [
      "Wheek wheek! I'm Bollo! 🐹",
      "Let's count together! 🔢",
      "Crunch crunch… I love red peppers! 😋",
    ],
    es: [
      "¡Uic uic! ¡Soy Bollo! 🐹",
      "¡Vamos a contar juntos! 🔢",
      "¡Ñam ñam… me encantan los pimientos rojos! 😋",
    ],
  },
  css: `
    .mascot-bollo .limb.l { transform-origin: 90% 35%; }
    .mascot-bollo .limb.r { transform-origin: 10% 35%; }
    .mascot-bollo.mood-happy .limb.l { animation-name: bollo-ear-l; }
    .mascot-bollo.mood-happy .limb.r { animation-name: bollo-ear-r; }
    @keyframes bollo-ear-l { to { transform: rotate(20deg); } }
    @keyframes bollo-ear-r { to { transform: rotate(-20deg); } }
  `,
  svg: `
  <svg class="mascot" viewBox="-10 -24 220 234" aria-hidden="true">
    <g class="float">
      <g transform="translate(-8 -24) scale(.44)">
        <path d="M50 30 C56 18 64 12 72 11" fill="none" stroke="#2f9e44" stroke-width="7" stroke-linecap="round" />
        <path d="M30 34 C36 28 44 30 50 34 C56 30 64 28 70 34 C74 30 78 29 82 33 L78 38 L22 38 L18 33 C22 29 26 30 30 34Z" fill="#40c057" />
        <path d="M20 40 C14 52 14 70 22 82 C28 91 38 93 44 88 C47 92 53 92 56 88 C62 93 72 91 78 82 C86 70 86 52 80 40 C74 33 62 33 56 38 C53 35 47 35 44 38 C38 33 26 33 20 40Z" fill="#e8413c" />
        <path d="M44 40 C40 54 40 72 44 86 M56 40 C60 54 60 72 56 86" fill="none" stroke="#b92a26" stroke-width="3" stroke-linecap="round" opacity=".55" />
        <path d="M27 48 C24 56 24 64 27 70" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".6" />
      </g>
    </g>
    <g class="zzz" fill="#fff" stroke="#26315c" stroke-width="1.5" font-weight="700">
      <text x="150" y="30" font-size="30">Z</text><text x="176" y="4" font-size="22">z</text>
    </g>
    <g class="sparkles" fill="#fff" font-size="26">
      <text x="-6" y="60">✦</text><text x="186" y="96">✦</text><text x="10" y="186" font-size="18">✦</text>
    </g>
    <!-- back feet -->
    <ellipse cx="34" cy="186" rx="15" ry="8" fill="#fff" />
    <ellipse cx="166" cy="186" rx="15" ry="8" fill="#fff" />
    <!-- ears -->
    <g class="limb l">
      <path d="M66 70 C52 58 22 60 10 76 C2 88 10 100 24 96 C36 92 46 84 56 80Z" fill="#7a4420" />
      <path d="M60 74 C48 66 26 68 17 80 C12 88 18 93 26 90 C36 86 44 82 52 80Z" fill="#f4a3ae" />
    </g>
    <g class="limb r">
      <path d="M134 70 C148 58 178 60 190 76 C198 88 190 100 176 96 C164 92 154 84 144 80Z" fill="#7a4420" />
      <path d="M140 74 C152 66 174 68 183 80 C188 88 182 93 174 90 C164 86 156 82 148 80Z" fill="#f4a3ae" />
    </g>
    <!-- fluffy brown body -->
    <path d="M100 58 C154 58 194 86 196 126 C197 152 184 172 168 182 C152 194 124 196 100 196 C76 196 48 194 32 182 C16 172 3 152 4 126 C6 86 46 58 100 58Z" fill="#a8652f" />
    <path d="M6 134 l-10 6 l11 3 l-8 9 l12 -1 M194 134 l10 6 l-11 3 l8 9 l-12 -1" fill="#a8652f" />
    <path d="M44 86 C56 74 68 70 80 68 M120 68 C132 70 144 74 156 86" stroke="#8f5226" stroke-width="5" stroke-linecap="round" fill="none" />
    <!-- white blaze, muzzle and belly -->
    <path d="M91 59 C96 57 104 57 109 59 C110 76 108 98 114 124 L86 124 C92 98 90 72 91 51Z" fill="#fffaf3" />
    <ellipse cx="100" cy="170" rx="52" ry="22" fill="#fffaf3" />
    <ellipse cx="100" cy="138" rx="30" ry="20" fill="#fffaf3" />
    <!-- head tuft -->
    <path d="M86 64 C86 50 94 44 98 52 C100 40 110 38 110 52 C116 46 124 50 116 64Z" fill="#fffaf3" />
    <!-- cheeks -->
    <ellipse cx="48" cy="138" rx="13" ry="8" fill="#ff9fb5" opacity=".8" />
    <ellipse cx="152" cy="138" rx="13" ry="8" fill="#ff9fb5" opacity=".8" />
    <!-- front paws -->
    <ellipse cx="78" cy="190" rx="12" ry="8" fill="#fff" />
    <ellipse cx="122" cy="190" rx="12" ry="8" fill="#fff" />
    <path d="M74 186 v5 M82 186 v5 M118 186 v5 M126 186 v5" stroke="#f0a5b0" stroke-width="2" stroke-linecap="round" />
    <g class="eyes-open">
      <circle cx="68" cy="104" r="14.5" fill="#fffaf3" />
      <circle cx="132" cy="104" r="14.5" fill="#fffaf3" />
      <circle class="pupil" cx="69" cy="105" r="11.5" fill="#26315c" />
      <circle class="pupil" cx="131" cy="105" r="11.5" fill="#26315c" />
      <circle cx="73" cy="100" r="4" fill="#fff" />
      <circle cx="135" cy="100" r="4" fill="#fff" />
      <circle cx="65" cy="110" r="1.8" fill="#fff" opacity=".8" />
      <circle cx="127" cy="110" r="1.8" fill="#fff" opacity=".8" />
      <circle class="lid" cx="68" cy="104" r="16" fill="#a8652f" />
      <circle class="lid" cx="132" cy="104" r="16" fill="#a8652f" />
    </g>
    <g class="eyes-happy" stroke="#26315c" stroke-width="6" stroke-linecap="round" fill="none">
      <path d="M55 108 Q68 91 81 108" /><path d="M119 108 Q132 91 145 108" />
    </g>
    <g class="eyes-closed" stroke="#26315c" stroke-width="6" stroke-linecap="round" fill="none">
      <path d="M55 102 Q68 115 81 102" /><path d="M119 102 Q132 115 145 102" />
    </g>
    <!-- whiskers -->
    <g stroke="#f3e4d4" stroke-width="2" stroke-linecap="round" fill="none">
      <path d="M74 134 L44 127 M74 140 L42 144 M126 134 L156 127 M126 140 L158 144" />
    </g>
    <g class="mouth">
      <ellipse cx="100" cy="142" rx="9" ry="10" fill="#8a2d1b" />
      <rect x="95.5" y="132" width="9" height="7" rx="2" fill="#fff" />
    </g>
    <path d="M100 130 v4 M100 134 Q95 139 90 136 M100 134 Q105 139 110 136" stroke="#26315c" stroke-width="3" stroke-linecap="round" fill="none" />
    <path d="M91 124 Q100 118 109 124 Q105 131 100 131 Q95 131 91 124Z" fill="#ff8fab" />
  </svg>`,
});
