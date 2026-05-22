const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const normalizeAccentSearchText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const keywordMatchesText = (keyword, text) => {
  const normalizedKeyword = normalizeAccentSearchText(keyword);
  if (!normalizedKeyword || !text) return false;
  if (normalizedKeyword.includes(" ")) {
    return text.includes(normalizedKeyword);
  }
  return new RegExp(`\\b${escapeRegExp(normalizedKeyword)}\\b`, "i").test(text);
};

export const ARABIC_ACCENT_ALIASES = [
  {
    token: "arabic-saudi",
    display: "Saudi",
    keywords: ["saudi", "ksa", "saudi arabia", "najdi", "hejazi", "hijazi"],
    patterns: [/\bsaudi\b/i, /\bksa\b/i, /\bsaudi\s+arabia\b/i, /\bnajdi\b/i, /\bhejazi\b/i, /\bhijazi\b/i],
    localePatterns: [/\bar[-_\s]?sa\b/i],
  },
  {
    token: "arabic-gulf",
    display: "Gulf",
    keywords: [
      "gulf",
      "khaliji",
      "khaleeji",
      "emirati",
      "uae",
      "kuwaiti",
      "qatari",
      "bahraini",
      "omani",
    ],
    patterns: [
      /\bgulf\b/i,
      /\bkhaliji\b/i,
      /\bkhaleeji\b/i,
      /\bkhaleeji\s+arabic\b/i,
      /\bemirati\b/i,
      /\bkuwaiti\b/i,
      /\bqatari\b/i,
      /\bbahraini\b/i,
      /\bomani\b/i,
      /\buae\b/i,
    ],
    localePatterns: [/\bar[-_\s]?(ae|kw|qa|bh|om)\b/i],
  },
  {
    token: "arabic-egyptian",
    display: "Egyptian",
    keywords: ["egyptian", "egypt", "masri", "masry", "cairo", "cairene"],
    patterns: [/\begyptian\b/i, /\begypt\b/i, /\bmasri\b/i, /\bmasry\b/i, /\bcairo\b/i, /\bcairene\b/i],
    localePatterns: [/\bar[-_\s]?eg\b/i],
  },
  {
    token: "arabic-levantine",
    display: "Levantine",
    keywords: [
      "levantine",
      "shami",
      "lebanese",
      "syrian",
      "jordanian",
      "palestinian",
    ],
    patterns: [
      /\blevantine\b/i,
      /\bshami\b/i,
      /\blebanese\b/i,
      /\bsyrian\b/i,
      /\bjordanian\b/i,
      /\bpalestinian\b/i,
    ],
    localePatterns: [/\bar[-_\s]?(lb|sy|jo|ps)\b/i],
  },
  {
    token: "arabic-moroccan",
    display: "Moroccan",
    keywords: [
      "moroccan",
      "morocco",
      "maghrebi",
      "maghreb",
      "darija",
      "algerian",
      "algeria",
      "tunisian",
      "tunisia",
    ],
    patterns: [
      /\bmoroccan\b/i,
      /\bmorocco\b/i,
      /\bmaghrebi\b/i,
      /\bmaghreb\b/i,
      /\bdarija\b/i,
      /\balgerian\b/i,
      /\balgeria\b/i,
      /\btunisian\b/i,
      /\btunisia\b/i,
    ],
    localePatterns: [/\bar[-_\s]?(ma|dz|tn)\b/i],
  },
  {
    token: "arabic-standard",
    display: "Standard Arabic",
    keywords: [
      "standard arabic",
      "modern standard arabic",
      "modern standard",
      "msa",
      "fusha",
      "fus-ha",
      "classical arabic",
    ],
    patterns: [
      /\bstandard\s+arabic\b/i,
      /\bmodern\s+standard\s+arabic\b/i,
      /\bmodern\s+standard\b/i,
      /\bmsa\b/i,
      /\bfusha\b/i,
      /\bclassical\s+arabic\b/i,
    ],
  },
];

export const ENGLISH_ACCENT_ALIASES = [
  {
    token: "american",
    display: "American",
    keywords: ["american", "usa", "united states"],
    patterns: [/\bamerican\b/i, /\bunited\s+states\b/i, /\busa\b/i],
    localePatterns: [/\ben[-_\s]?us\b/i],
  },
  {
    token: "british",
    display: "British",
    keywords: ["british", "uk", "united kingdom"],
    patterns: [/\bbritish\b/i, /\bunited\s+kingdom\b/i, /\buk\b/i],
    localePatterns: [/\ben[-_\s]?gb\b/i],
  },
  {
    token: "australian",
    display: "Australian",
    keywords: ["australian", "australia", "aussie"],
    patterns: [/\baustralian\b/i, /\baustralia\b/i, /\baussie\b/i],
    localePatterns: [/\ben[-_\s]?au\b/i],
  },
  {
    token: "indian",
    display: "Indian",
    keywords: ["indian", "india"],
    patterns: [/\bindian\b/i, /\bindia\b/i],
    localePatterns: [/\ben[-_\s]?in\b/i],
  },
  {
    token: "neutral",
    display: "Neutral",
    keywords: ["neutral", "generic", "international", "global"],
    patterns: [/\bneutral\b/i, /\bgeneric\b/i, /\binternational\b/i, /\bglobal\b/i],
  },
];

export const CANONICAL_ACCENT_LOOKUP = {
  american: "american",
  usa: "american",
  us: "american",
  "u s": "american",
  "u.s": "american",
  "u.s.a": "american",
  "united states": "american",
  "united states of america": "american",
  british: "british",
  uk: "british",
  "u k": "british",
  england: "british",
  "united kingdom": "british",
  australian: "australian",
  australia: "australian",
  aussie: "australian",
  indian: "indian",
  india: "indian",
  neutral: "neutral",
  generic: "neutral",
  international: "neutral",
  global: "neutral",
  spanish: "spanish",
  spain: "spanish",
  "latin american spanish": "spanish",
  castilian: "spanish",
  "arabic general": "arabic-general",
};

export const ARABIC_GENERAL_DISPLAY = "Arabic General";
export const ARABIC_GENERAL_TOKEN = "arabic-general";

const stripArabicAccentLabelPrefix = (display) =>
  String(display || "")
    .trim()
    .replace(/^arabic\s*[-–—:]\s*/i, "");

const arabicAccentAliasMatchesText = (alias, text) => {
  const normalized = normalizeAccentSearchText(text);
  if (!normalized) return false;
  if (alias.localePatterns?.some((pattern) => pattern.test(normalized))) return true;
  if (alias.patterns?.some((pattern) => pattern.test(normalized))) return true;
  return (alias.keywords || []).some((keyword) => keywordMatchesText(keyword, normalized));
};

const accentAliasForValue = (value) => {
  const text = normalizeAccentSearchText(stripArabicAccentLabelPrefix(value));
  if (!text) return null;
  const byPattern = ARABIC_ACCENT_ALIASES.find((alias) => arabicAccentAliasMatchesText(alias, text));
  if (byPattern) return byPattern;
  const englishAlias =
    ENGLISH_ACCENT_ALIASES.find((alias) => alias.patterns?.some((pattern) => pattern.test(text))) ||
    ENGLISH_ACCENT_ALIASES.find((alias) => normalizeAccentSearchText(alias.display) === text) ||
    ENGLISH_ACCENT_ALIASES.find((alias) =>
      (alias.keywords || []).some((keyword) => keywordMatchesText(keyword, text))
    );
  if (englishAlias) return englishAlias;
  return ARABIC_ACCENT_ALIASES.find((alias) => normalizeAccentSearchText(alias.display) === text) || null;
};

export const normalizeAccentToken = (value) => {
  const text = normalizeAccentSearchText(stripArabicAccentLabelPrefix(value));
  if (!text) return "";
  if (CANONICAL_ACCENT_LOOKUP[text]) return CANONICAL_ACCENT_LOOKUP[text];
  const alias = accentAliasForValue(value);
  if (alias) return alias.token;
  return text;
};

export const ENGLISH_ACCENT_TOKENS = new Set(ENGLISH_ACCENT_ALIASES.map((alias) => alias.token));
export const ARABIC_DIALECT_ACCENT_TOKENS = new Set([
  ...ARABIC_ACCENT_ALIASES.map((alias) => alias.token),
  ARABIC_GENERAL_TOKEN,
]);
