// Pipo — a cheerful yellow chick who loves to sing.
Mascots.register({
  id: "pipo",
  name: { en: "Pipo", es: "Pipo" },
  emoji: "🐤",
  color: "#ffd23f",
  about: {
    en: "A little chick who loves to sing",
    es: "Un pollito al que le encanta cantar",
  },
  sound: "chirp",
  treat: {
    icon: "🌽",
    name: {
      en: { one: "corn cob", many: "corn cobs" },
      es: { one: "mazorca", many: "mazorcas" },
    },
  },
  greeting: {
    en: [
      "Tweet tweet! I'm Pipo! 🎶",
      "Let's sing together! 🎤",
      "La la laaa! 🎵",
    ],
    es: [
      "¡Pío pío! ¡Soy Pipo! 🎶",
      "¡Vamos a cantar juntos! 🎤",
      "¡La la laaa! 🎵",
    ],
  },
  svg: `
  <svg class="mascot" viewBox="-10 -24 220 234" aria-hidden="true">
    <g class="float"><text x="4" y="34" font-size="30">🎵</text></g>
    <g class="zzz" fill="#fff" stroke="#26315c" stroke-width="1.5" font-weight="700">
      <text x="150" y="30" font-size="30">Z</text><text x="176" y="4" font-size="22">z</text>
    </g>
    <g class="sparkles" fill="#fff" font-size="26">
      <text x="-6" y="60">✦</text><text x="182" y="92">✦</text><text x="14" y="176" font-size="18">✦</text>
    </g>
    <g stroke="#f08a24" stroke-width="7" stroke-linecap="round" fill="none">
      <path d="M78 184 l-10 14 M78 184 v16 M78 184 l10 14" />
      <path d="M122 184 l-10 14 M122 184 v16 M122 184 l10 14" />
    </g>
    <path class="limb l" d="M36 96 C10 104 8 144 30 150 C42 140 46 116 36 96Z" fill="#ffb627" />
    <path class="limb r" d="M164 96 C190 104 192 144 170 150 C158 140 154 116 164 96Z" fill="#ffb627" />
    <path d="M90 46 C82 22 96 10 104 10 C100 22 106 30 112 32 C114 20 126 14 136 18 C124 24 122 36 120 48Z" fill="#ffb627" />
    <ellipse cx="100" cy="116" rx="72" ry="74" fill="#ffd23f" />
    <ellipse cx="100" cy="144" rx="46" ry="40" fill="#fff3c4" />
    <ellipse cx="54" cy="122" rx="13" ry="8" fill="#ff8fab" opacity=".75" />
    <ellipse cx="146" cy="122" rx="13" ry="8" fill="#ff8fab" opacity=".75" />
    <g class="eyes-open">
      <ellipse cx="74" cy="92" rx="17" ry="20" fill="#fff" />
      <ellipse cx="126" cy="92" rx="17" ry="20" fill="#fff" />
      <circle class="pupil" cx="77" cy="95" r="10" fill="#26315c" />
      <circle class="pupil" cx="129" cy="95" r="10" fill="#26315c" />
      <circle cx="81" cy="90" r="3.5" fill="#fff" />
      <circle cx="133" cy="90" r="3.5" fill="#fff" />
      <ellipse class="lid" cx="74" cy="92" rx="18" ry="21" fill="#ffd23f" />
      <ellipse class="lid" cx="126" cy="92" rx="18" ry="21" fill="#ffd23f" />
    </g>
    <g class="eyes-happy" stroke="#26315c" stroke-width="6" stroke-linecap="round" fill="none">
      <path d="M60 98 Q74 78 88 98" /><path d="M112 98 Q126 78 140 98" />
    </g>
    <g class="eyes-closed" stroke="#26315c" stroke-width="6" stroke-linecap="round" fill="none">
      <path d="M60 92 Q74 104 88 92" /><path d="M112 92 Q126 104 140 92" />
    </g>
    <ellipse class="mouth" cx="100" cy="113" rx="11" ry="10" fill="#8a2d1b" />
    <path class="jaw" d="M90 112 Q100 124 110 112Z" fill="#e0701a" />
    <path d="M84 110 Q100 96 116 110 Q100 120 84 110Z" fill="#f79222" />
  </svg>`,
});
