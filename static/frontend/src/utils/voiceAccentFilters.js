import { normalizeLanguageFilterValue } from "../components/voiceFilterLanguage";

const FACET_SPLIT = /[,;/|]/;

const pushFacetTokens = (raw, bucket) => {
  if (raw == null) return;
  if (Array.isArray(raw)) {
    raw.forEach((x) => pushFacetTokens(x, bucket));
    return;
  }
  if (typeof raw === "string") {
    raw
      .split(FACET_SPLIT)
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((x) => bucket.push(x));
    return;
  }
  const s = String(raw).trim();
  if (s) bucket.push(s);
};

const collectFacetDisplaysFromVoice = (voice, ...keys) => {
  const bucket = [];
  for (const key of keys) {
    pushFacetTokens(voice?.[key], bucket);
    if (voice?.labels && typeof voice.labels === "object") pushFacetTokens(voice.labels[key], bucket);
  }
  return bucket;
};

const collectVoiceTextMetadata = (value, bucket) => {
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectVoiceTextMetadata(item, bucket));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectVoiceTextMetadata(item, bucket));
    return;
  }
  const text = String(value).trim();
  if (text) bucket.push(text);
};

const voiceMetadataHaystack = (voice) => {
  const bucket = [];
  collectVoiceTextMetadata(voice?.name, bucket);
  collectVoiceTextMetadata(voice?.description, bucket);
  collectVoiceTextMetadata(voice?.category, bucket);
  collectVoiceTextMetadata(voice?.accent, bucket);
  collectVoiceTextMetadata(voice?.locale, bucket);
  collectVoiceTextMetadata(voice?.language, bucket);
  collectVoiceTextMetadata(voice?.languages, bucket);
  collectVoiceTextMetadata(voice?.labels, bucket);
  collectVoiceTextMetadata(voice?.languageAccents, bucket);
  collectVoiceTextMetadata(voice?.languageAccentPairs, bucket);
  collectVoiceTextMetadata(voice?.language_accents, bucket);
  collectVoiceTextMetadata(voice?.verified_languages, bucket);
  collectVoiceTextMetadata(voice?.verifiedLanguages, bucket);
  return bucket.join(" ").toLowerCase();
};

const collectLanguageDisplaysFromVoice = (voice) => {
  const acc = [];
  pushFacetTokens(voice?.language, acc);
  pushFacetTokens(voice?.languages, acc);
  pushFacetTokens(voice?.locale, acc);
  if (voice?.labels && typeof voice.labels === "object") {
    pushFacetTokens(voice.labels.languages, acc);
    pushFacetTokens(voice.labels.language, acc);
    pushFacetTokens(voice.labels.Language, acc);
    pushFacetTokens(voice.labels.locale, acc);
    pushFacetTokens(voice.labels.Locale, acc);
  }
  return acc;
};

const normalizeAccentSearchText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Canonical Arabic dialect filters: token is what filtering compares; display is dropdown label. */
const ARABIC_ACCENT_ALIASES = [
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
];

const ARABIC_DIALECT_ACCENT_TOKENS = new Set(ARABIC_ACCENT_ALIASES.map((alias) => alias.token));
const ARABIC_ACCENT_ALIAS_BY_TOKEN = new Map(ARABIC_ACCENT_ALIASES.map((alias) => [alias.token, alias]));

const ENGLISH_ACCENT_ALIASES = [
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

const ENGLISH_ACCENT_ALIAS_BY_TOKEN = new Map(ENGLISH_ACCENT_ALIASES.map((alias) => [alias.token, alias]));

/** Exact normalized accent tokens (after lowercase + trim + punctuation collapse). */
const CANONICAL_ACCENT_LOOKUP = {
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
};

const keywordMatchesText = (keyword, text) => {
  const normalizedKeyword = normalizeAccentSearchText(keyword);
  if (!normalizedKeyword || !text) return false;
  if (normalizedKeyword.includes(" ")) {
    return text.includes(normalizedKeyword);
  }
  return new RegExp(`\\b${escapeRegExp(normalizedKeyword)}\\b`, "i").test(text);
};

const arabicAccentAliasMatchesText = (alias, text) => {
  const normalized = normalizeAccentSearchText(text);
  if (!normalized) return false;
  if (alias.localePatterns?.some((pattern) => pattern.test(normalized))) return true;
  if (alias.patterns?.some((pattern) => pattern.test(normalized))) return true;
  return (alias.keywords || []).some((keyword) => keywordMatchesText(keyword, normalized));
};

const stripArabicAccentLabelPrefix = (display) =>
  String(display || "")
    .trim()
    .replace(/^arabic\s*[-–—:]\s*/i, "");

const accentAliasForValue = (value) => {
  const text = normalizeAccentSearchText(stripArabicAccentLabelPrefix(value));
  if (!text) return null;
  const byPattern = ARABIC_ACCENT_ALIASES.find((alias) => arabicAccentAliasMatchesText(alias, text));
  if (byPattern) return byPattern;
  const englishAlias =
    ENGLISH_ACCENT_ALIASES.find((alias) => alias.patterns?.some((pattern) => pattern.test(text))) ||
    ENGLISH_ACCENT_ALIASES.find((alias) => normalizeAccentSearchText(alias.display) === text) ||
    ENGLISH_ACCENT_ALIASES.find((alias) => (alias.keywords || []).some((keyword) => keywordMatchesText(keyword, text)));
  if (englishAlias) return englishAlias;
  return (
    ARABIC_ACCENT_ALIASES.find((alias) => normalizeAccentSearchText(alias.display) === text) || null
  );
};

export const normalizeAccentToken = (value) => {
  const text = normalizeAccentSearchText(stripArabicAccentLabelPrefix(value));
  if (!text) return "";
  if (CANONICAL_ACCENT_LOOKUP[text]) return CANONICAL_ACCENT_LOOKUP[text];
  const alias = accentAliasForValue(value);
  if (alias) return alias.token;
  return text;
};

const formatAccentDisplayForLanguage = (display, language) => {
  const cleaned = stripArabicAccentLabelPrefix(display);
  if (normalizeLanguageFilterValue(language) !== "ar") return cleaned;
  const alias = accentAliasForValue(cleaned);
  return alias?.display || cleaned;
};

const voiceHasArabicMetadata = (voice) => {
  const haystack = voiceMetadataHaystack(voice);
  if (!haystack) return false;
  return (
    /\barabic\b/i.test(haystack) ||
    /[\u0600-\u06FF]/.test(haystack) ||
    ARABIC_ACCENT_ALIASES.some((alias) => arabicAccentAliasMatchesText(alias, haystack))
  );
};

const voiceHasEnglishMetadata = (voice) => {
  const haystack = voiceMetadataHaystack(voice);
  if (!haystack) return false;
  return /\benglish\b/i.test(haystack) || ENGLISH_ACCENT_ALIASES.some((alias) => arabicAccentAliasMatchesText(alias, haystack));
};

const voiceIsArabicForAccentFilter = (voice) =>
  languageFilterMatches("ar", languageMatchTokensForVoice(voice)) || voiceHasArabicMetadata(voice);

/** True when accent filter is one of the Arabic dialect options (Saudi, Gulf, Egyptian, etc.). */
export const isArabicDialectAccentFilter = (accentValue) =>
  ARABIC_DIALECT_ACCENT_TOKENS.has(normalizeAccentToken(accentValue));

/** @deprecated Use isArabicDialectAccentFilter */
export const isArabicRegionalAccentFilter = isArabicDialectAccentFilter;

export const ARABIC_ACCENT_OPTIONS = ARABIC_ACCENT_ALIASES.map((alias) => alias.display);
export const ENGLISH_ACCENT_OPTIONS = ENGLISH_ACCENT_ALIASES.map((alias) => alias.display);

export const languageForAccentValue = (accentValue) => {
  const token = normalizeAccentToken(accentValue);
  if (ARABIC_DIALECT_ACCENT_TOKENS.has(token)) return "ar";
  if (ENGLISH_ACCENT_ALIAS_BY_TOKEN.has(token)) return "en";
  return "";
};

const formatAccentDisplay = (token) =>
  String(token || "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const uniqueSortedDisplay = (displays) =>
  Array.from(new Set(displays.map((x) => String(x).trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

export const languageMatchTokensForVoice = (voice) => {
  const seen = new Set();
  const out = [];
  for (const display of collectLanguageDisplaysFromVoice(voice)) {
    const low = normalizeLanguageFilterValue(display);
    if (!low || seen.has(low)) continue;
    seen.add(low);
    out.push(low);
  }
  return out;
};

export const languageFilterMatches = (selectedLower, voiceLangTokens) => {
  if (!selectedLower) return true;
  if (!voiceLangTokens.length) return false;
  return voiceLangTokens.some(
    (token) =>
      token === selectedLower ||
      token.startsWith(`${selectedLower}-`) ||
      selectedLower.startsWith(`${token}-`)
  );
};

export const languageMatchesVoice = (language, voice) => {
  const normalizedLanguage = normalizeLanguageFilterValue(language);
  if (languageFilterMatches(normalizedLanguage, languageMatchTokensForVoice(voice))) return true;
  if (normalizedLanguage === "en" && voiceHasEnglishMetadata(voice)) return true;
  return normalizedLanguage === "ar" && voiceHasArabicMetadata(voice);
};

const collectLanguageAccentProfilesFromVoice = (voice) => {
  const profiles = [];
  const addProfile = (raw) => {
    if (!raw || typeof raw !== "object") return;
    const profileLanguage = String(raw.language || raw.Language || raw.locale || raw.Locale || "").trim();
    const accent = String(raw.accent || raw.Accent || "").trim();
    if (profileLanguage || accent) profiles.push({ language: profileLanguage, accent });
  };

  addProfile({
    language: voice?.language || voice?.labels?.language || voice?.labels?.Language,
    locale: voice?.locale || voice?.labels?.locale || voice?.labels?.Locale,
    accent: voice?.accent || voice?.labels?.accent || voice?.labels?.Accent,
  });

  [
    voice?.languageAccents,
    voice?.languageAccentPairs,
    voice?.language_accents,
    voice?.verified_languages,
    voice?.verifiedLanguages,
    voice?.labels?.languageAccents,
    voice?.labels?.languageAccentPairs,
    voice?.labels?.language_accents,
    voice?.labels?.verified_languages,
    voice?.labels?.verifiedLanguages,
  ].forEach((list) => {
    if (Array.isArray(list)) list.forEach(addProfile);
  });

  const seen = new Set();
  return profiles.filter((profile) => {
    const key = `${profile.language.toLowerCase()}|${profile.accent.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const languageMatchesAccentProfile = (language, profile) => {
  const selected = normalizeLanguageFilterValue(language);
  if (!selected) return true;
  const profileLang = normalizeLanguageFilterValue(profile?.language);
  if (!profileLang) return false;
  return languageFilterMatches(selected, [profileLang]);
};

const profileAccentTokensForLanguage = (voice, language, allowedTokens) =>
  collectLanguageAccentProfilesFromVoice(voice)
    .filter((profile) => !profile.language || languageMatchesAccentProfile(language, profile))
    .map((profile) => normalizeAccentToken(profile.accent))
    .filter((token) => token && (!allowedTokens || allowedTokens.has(token)));

const directAccentTokensForLanguage = (voice, language, allowedTokens) =>
  collectFacetDisplaysFromVoice(voice, "accent", "Accent")
    .map((accent) => normalizeAccentToken(accent))
    .filter((token) => token && (!allowedTokens || allowedTokens.has(token)));

const localeAccentTokensForAliases = (voice, aliases) => {
  const haystack = normalizeAccentSearchText(voiceMetadataHaystack(voice));
  if (!haystack) return [];
  return aliases
    .filter((alias) => alias.localePatterns?.some((pattern) => pattern.test(haystack)))
    .map((alias) => alias.token);
};

const arabicAccentMatchDetailsForVoice = (voice) => {
  if (!voiceIsArabicForAccentFilter(voice)) return [];
  const haystack = normalizeAccentSearchText(voiceMetadataHaystack(voice));
  return ARABIC_ACCENT_ALIASES.map((alias) => {
    const keywordMatches = (alias.keywords || []).filter((keyword) => keywordMatchesText(keyword, haystack));
    const localeMatches = (alias.localePatterns || [])
      .filter((pattern) => pattern.test(haystack))
      .map((pattern) => `locale:${pattern.source}`);
    const patternMatches = (alias.patterns || [])
      .filter((pattern) => pattern.test(haystack))
      .map((pattern) => `pattern:${pattern.source}`);
    const matchedKeywords = uniqueSortedDisplay([...keywordMatches, ...localeMatches, ...patternMatches]);
    return matchedKeywords.length ? { token: alias.token, display: alias.display, matchedKeywords } : null;
  }).filter(Boolean);
};

const englishAccentMatchDetailsForVoice = (voice) => {
  const haystack = normalizeAccentSearchText(voiceMetadataHaystack(voice));
  if (!haystack) return [];
  return ENGLISH_ACCENT_ALIASES.map((alias) => {
    const keywordMatches = (alias.keywords || []).filter((keyword) => keywordMatchesText(keyword, haystack));
    const localeMatches = (alias.localePatterns || [])
      .filter((pattern) => pattern.test(haystack))
      .map((pattern) => `locale:${pattern.source}`);
    const patternMatches = (alias.patterns || [])
      .filter((pattern) => pattern.test(haystack))
      .map((pattern) => `pattern:${pattern.source}`);
    const matchedKeywords = uniqueSortedDisplay([...keywordMatches, ...localeMatches, ...patternMatches]);
    return matchedKeywords.length ? { token: alias.token, display: alias.display, matchedKeywords } : null;
  }).filter(Boolean);
};

const voiceDebugLabel = (voice) =>
  voice?.name || voice?.displayName || voice?.providerVoiceId || voice?.voiceId || voice?.id || "unknown voice";

const shouldLogAccentDecision = () => {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
};

const debugAccentDecisions = (rows) => {
  if (!shouldLogAccentDecision() || typeof console === "undefined" || typeof console.table !== "function") {
    return;
  }
  console.table(rows);
};

const detectedAccentDetailsForLanguage = (voice, language) => {
  const normalizedLanguage = normalizeLanguageFilterValue(language);
  if (normalizedLanguage === "ar") {
    const directTokens = uniqueSortedDisplay(directAccentTokensForLanguage(voice, "ar", ARABIC_DIALECT_ACCENT_TOKENS));
    if (directTokens.length) {
      return {
        tokens: directTokens,
        keywords: directTokens.map((token) => `${ARABIC_ACCENT_ALIAS_BY_TOKEN.get(token)?.display || token}:direct`),
        source: "direct",
      };
    }
    const profileTokens = uniqueSortedDisplay(profileAccentTokensForLanguage(voice, "ar", ARABIC_DIALECT_ACCENT_TOKENS));
    if (profileTokens.length) {
      return {
        tokens: profileTokens,
        keywords: profileTokens.map((token) => `${ARABIC_ACCENT_ALIAS_BY_TOKEN.get(token)?.display || token}:profile`),
        source: "profile",
      };
    }
    const localeTokens = uniqueSortedDisplay(localeAccentTokensForAliases(voice, ARABIC_ACCENT_ALIASES));
    if (localeTokens.length) {
      return {
        tokens: localeTokens,
        keywords: localeTokens.map((token) => `${ARABIC_ACCENT_ALIAS_BY_TOKEN.get(token)?.display || token}:locale`),
        source: "locale",
      };
    }
    const details = arabicAccentMatchDetailsForVoice(voice);
    return {
      details,
      tokens: uniqueSortedDisplay(details.map((detail) => detail.token)),
      keywords: uniqueSortedDisplay([
        ...details.flatMap((detail) =>
          detail.matchedKeywords.map((keyword) => `${ARABIC_ACCENT_ALIAS_BY_TOKEN.get(detail.token)?.display || detail.token}:${keyword}`)
        ),
      ]),
      source: "metadata",
    };
  }
  if (normalizedLanguage === "en") {
    const englishAllowedTokens = new Set(ENGLISH_ACCENT_ALIASES.map((alias) => alias.token));
    const directTokens = uniqueSortedDisplay(directAccentTokensForLanguage(
      voice,
      "en",
      englishAllowedTokens
    ));
    if (directTokens.length) {
      return {
        tokens: directTokens,
        keywords: directTokens.map((token) => `${ENGLISH_ACCENT_ALIAS_BY_TOKEN.get(token)?.display || token}:direct`),
        source: "direct",
      };
    }
    const profileTokens = uniqueSortedDisplay(profileAccentTokensForLanguage(voice, "en", englishAllowedTokens));
    if (profileTokens.length) {
      return {
        tokens: profileTokens,
        keywords: profileTokens.map((token) => `${ENGLISH_ACCENT_ALIAS_BY_TOKEN.get(token)?.display || token}:profile`),
        source: "profile",
      };
    }
    const localeTokens = uniqueSortedDisplay(localeAccentTokensForAliases(voice, ENGLISH_ACCENT_ALIASES));
    if (localeTokens.length) {
      return {
        tokens: localeTokens,
        keywords: localeTokens.map((token) => `${ENGLISH_ACCENT_ALIAS_BY_TOKEN.get(token)?.display || token}:locale`),
        source: "locale",
      };
    }
    const details = englishAccentMatchDetailsForVoice(voice);
    return {
      details,
      tokens: uniqueSortedDisplay(details.map((detail) => detail.token)),
      keywords: uniqueSortedDisplay([
        ...details.flatMap((detail) =>
          detail.matchedKeywords.map((keyword) => `${ENGLISH_ACCENT_ALIAS_BY_TOKEN.get(detail.token)?.display || detail.token}:${keyword}`)
        ),
      ]),
      source: "metadata",
    };
  }
  const tokens = accentDisplaysForLanguageFromVoice(voice, normalizedLanguage).map(normalizeAccentToken).filter(Boolean);
  return { details: [], tokens: uniqueSortedDisplay(tokens), keywords: [], source: "accent" };
};

const strictAccentDecision = (voice, language, accentToken) => {
  const normalizedLanguage = normalizeLanguageFilterValue(language);
  const detected = detectedAccentDetailsForLanguage(voice, normalizedLanguage);
  const detectedTokens = detected.tokens;
  const detectedAccent = detectedTokens.join(", ");
  const include = detectedTokens.length === 1 && detectedTokens[0] === accentToken;
  const reason = include
    ? "exact-accent-match"
    : detectedTokens.length === 0
      ? "no-detected-accent"
      : detectedTokens.includes(accentToken)
        ? "ambiguous-accent-metadata"
        : "detected-accent-mismatch";

  return {
    include,
    score: include ? 100 : 0,
    rank: include ? 4 : 0,
    normalizedAccent: accentToken,
    detectedTokens,
    detectedAccent,
    detectedKeywords: detected.keywords,
    source: detected.source,
    reason,
  };
};

/** Accent labels for a voice scoped to a language (display casing preserved). */
export const accentDisplaysForLanguageFromVoice = (voice, language) => {
  const normalizedLanguage = normalizeLanguageFilterValue(language);
  const profiles = collectLanguageAccentProfilesFromVoice(voice);
  const matchedProfiles = profiles.filter((profile) => languageMatchesAccentProfile(normalizedLanguage, profile));
  const matchedProfileAccents = matchedProfiles
    .map((profile) => profile.accent)
    .filter(Boolean)
    .map((accent) => formatAccentDisplayForLanguage(accent, normalizedLanguage));
  const inferredArabicAccents =
    normalizedLanguage === "ar" && languageMatchesVoice(normalizedLanguage, voice)
      ? arabicAccentMatchDetailsForVoice(voice).map((detail) => detail.display)
      : [];
  if (matchedProfiles.length) return uniqueSortedDisplay([...matchedProfileAccents, ...inferredArabicAccents]);
  if (profiles.length) return inferredArabicAccents.length ? uniqueSortedDisplay(inferredArabicAccents) : [];
  if (!languageMatchesVoice(normalizedLanguage, voice)) return [];
  return uniqueSortedDisplay([
    ...collectFacetDisplaysFromVoice(voice, "accent", "Accent").map((accent) =>
      formatAccentDisplayForLanguage(accent, normalizedLanguage)
    ),
    ...inferredArabicAccents,
  ]);
};

/** Lowercase accent tokens used when applying the accent filter (must match filter logic). */
export const accentTokensForLanguageFromVoice = (voice, language) => {
  const normalizedLanguage = normalizeLanguageFilterValue(language);
  if (normalizedLanguage === "ar") {
    return detectedAccentDetailsForLanguage(voice, normalizedLanguage).tokens;
  }
  if (normalizedLanguage === "en") {
    return detectedAccentDetailsForLanguage(voice, normalizedLanguage).tokens;
  }
  return accentDisplaysForLanguageFromVoice(voice, language).map(normalizeAccentToken).filter(Boolean);
};

export const rankVoiceForAccentForLanguage = (voice, language, accentValue) => {
  const accentToken = normalizeAccentToken(accentValue);
  const normalizedLanguage = normalizeLanguageFilterValue(language) || languageForAccentValue(accentToken);
  if (!accentToken) return { include: true, score: 0, rank: 0, normalizedAccent: "", reason: "no-accent-filter" };
  if (!languageMatchesVoice(normalizedLanguage, voice)) {
    return { include: false, score: 0, rank: 0, normalizedAccent: accentToken, reason: "language-mismatch" };
  }

  if (normalizedLanguage === "ar" || normalizedLanguage === "en") {
    return strictAccentDecision(voice, normalizedLanguage, accentToken);
  }

  const include = accentTokensForLanguageFromVoice(voice, normalizedLanguage).includes(accentToken);
  return {
    include,
    score: include ? 100 : 0,
    rank: include ? 4 : 0,
    normalizedAccent: accentToken,
    reason: include ? "exact-accent" : "accent-mismatch",
  };
};

export const rankVoicesForAccentForLanguage = (voices, language, accentValue) => {
  const accentToken = normalizeAccentToken(accentValue);
  if (!accentToken) return voices || [];
  const ranked = (voices || [])
    .map((voice, index) => ({ voice, index, decision: rankVoiceForAccentForLanguage(voice, language, accentToken) }))
    .sort((a, b) => b.decision.score - a.decision.score || b.decision.rank - a.decision.rank || a.index - b.index);

  debugAccentDecisions(
    ranked.map(({ voice, decision }) => ({
      selectedLanguage: normalizeLanguageFilterValue(language),
      selectedAccent: accentToken,
      voiceName: voiceDebugLabel(voice),
      detectedAccent: decision.detectedAccent || (decision.detectedTokens || []).join(", "),
      include: decision.include,
      reason: decision.reason,
      source: decision.source || "",
    }))
  );

  return ranked
    .filter((item) => item.decision.include)
    .map((item) => item.voice);
};

/** True when this voice matches language + accent using the same rules as client-side filtering. */
export const voiceMatchesAccentForLanguage = (voice, language, accentValue) =>
  rankVoiceForAccentForLanguage(voice, language, accentValue).include;

/**
 * Build accent dropdown options for a language.
 * Arabic always offers the five dialect filters; other options come from detected voices.
 */
export const buildAccentOptionsForLanguage = (voices, language, defaultLanguage = "en") => {
  const normalizedLanguage = normalizeLanguageFilterValue(language || defaultLanguage);
  const tokenToDisplay = new Map();

  if (normalizedLanguage === "ar") {
    return ARABIC_ACCENT_OPTIONS;
  }
  if (normalizedLanguage === "en") {
    return ENGLISH_ACCENT_OPTIONS;
  }

  for (const voice of voices || []) {
    if (!languageMatchesVoice(normalizedLanguage, voice)) continue;

    const tokens = accentTokensForLanguageFromVoice(voice, normalizedLanguage);
    const displays = accentDisplaysForLanguageFromVoice(voice, normalizedLanguage);
    for (const token of tokens) {
      if (!token || tokenToDisplay.has(token)) continue;
      if (!voiceMatchesAccentForLanguage(voice, normalizedLanguage, token)) continue;
      const display =
        displays.find((label) => normalizeAccentToken(label) === token) || formatAccentDisplay(token);
      tokenToDisplay.set(token, formatAccentDisplayForLanguage(display, normalizedLanguage));
    }
  }

  return uniqueSortedDisplay(Array.from(tokenToDisplay.values()));
};

export const countVoicesMatchingAccentForLanguage = (voices, language, accentValue) => {
  const normalizedLanguage = normalizeLanguageFilterValue(language);
  const accentToken = normalizeAccentToken(accentValue);
  if (!accentToken) return (voices || []).filter((voice) => languageMatchesVoice(normalizedLanguage, voice)).length;
  return (voices || []).filter((voice) => voiceMatchesAccentForLanguage(voice, normalizedLanguage, accentToken)).length;
};
