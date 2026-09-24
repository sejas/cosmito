// Shared i18n. The language is global: switching it in one game switches it everywhere.
//
// Each page owns a dictionary: { en: {...}, es: {...} }. Values may be strings,
// arrays or functions (called with extra args). Missing keys fall back to English.
// To add a language: add it to LANGS, then add a block to every dictionary.
const KidsI18n = (() => {
  const LANGS = [
    { code: "en", label: "English", flag: "🇬🇧" },
    { code: "es", label: "Español", flag: "🇪🇸" },
  ];
  const listeners = [];
  let lang = detect();
  document.documentElement.lang = lang;

  function detect() {
    const stored = KidsStore.load("lang", null);
    if (LANGS.some((l) => l.code === stored)) return stored;
    for (const pref of navigator.languages || [navigator.language || "en"]) {
      const code = pref.toLowerCase().slice(0, 2);
      if (LANGS.some((l) => l.code === code)) return code;
    }
    return "en";
  }

  function lookup(obj, key) {
    return key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  function t(dict, key, ...args) {
    const v = lookup(dict[lang], key) ?? lookup(dict.en, key);
    if (typeof v === "function") return v(...args);
    return v ?? key;
  }

  // Resolve a { en, es } object (song titles, mascot names…) to the current language.
  function pickLang(obj) {
    if (obj == null || typeof obj === "string") return obj;
    return obj[lang] ?? obj.en;
  }

  function set(code) {
    if (!LANGS.some((l) => l.code === code) || code === lang) return;
    lang = code;
    KidsStore.save("lang", code);
    document.documentElement.lang = code;
    listeners.forEach((fn) => fn(code));
  }

  function next() {
    const i = LANGS.findIndex((l) => l.code === lang);
    set(LANGS[(i + 1) % LANGS.length].code);
  }

  // Fill [data-i18n] (textContent) and [data-i18n-aria] (aria-label) elements.
  function apply(dict, root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(dict, el.dataset.i18n);
    });
    root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", t(dict, el.dataset.i18nAria));
    });
  }

  // A button that cycles through languages and shows the current one.
  function mountPicker(button) {
    const render = () => {
      const l = LANGS.find((x) => x.code === lang);
      button.textContent = `${l.flag} ${l.label}`;
    };
    button.addEventListener("click", next);
    listeners.push(render);
    render();
  }

  return {
    LANGS,
    get: () => lang,
    set,
    next,
    t,
    translator:
      (dict) =>
      (key, ...args) =>
        t(dict, key, ...args),
    pickLang,
    apply,
    mountPicker,
    onChange: (fn) => listeners.push(fn),
  };
})();
