import { normalizeLanguageFilterValue } from "../components/voiceFilterLanguage";
import {
  ARABIC_ACCENT_ALIASES,
  ARABIC_DIALECT_ACCENT_TOKENS,
  normalizeAccentToken,
} from "./voiceAccentConstants";

const FACET_SPLIT = /[,;/|]/;

/** Fields we read (never name, description, category, or other free-text marketing copy). */
const STRUCTURED_LANGUAGE_KEYS = ["language", "languages", "locale", "Language", "Locale", "languages"];
const STRUCTURED_ACCENT_KEYS = ["accent", "Accent"];

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

const normalizeSearchText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

/** Normalize BCP-47 tags only (`en-us`, `en`, `ar-sa`). Free-text labels return "". */
export const normalizeLocaleTag = (raw) => {
  const trimmed = String(raw || "").trim().toLowerCase().replace(/_/g, "-");
  if (!trimmed) return "";
  const match = trimmed.match(/^([a-z]{2,3})(?:[-]([a-z]{2,4}))?$/);
  if (match) {
    const lang = match[1];
    const region = match[2] || "";
    return region ? `${lang}-${region}` : lang;
  }
  return "";
};

/** Language codes that invalidate an English-only filter. */
const CONFLICTS_WITH_ENGLISH = new Set([
  "ar",
  "es",
  "de",
  "fr",
  "hi",
  "it",
  "pt",
  "zh",
  "ja",
  "ko",
  "ru",
  "nl",
  "pl",
  "tr",
  "sv",
  "id",
  "vi",
  "th",
  "uk",
  "cs",
  "el",
  "hu",
  "ro",
  "bg",
  "hr",
  "sk",
  "ta",
  "bn",
  "ur",
  "fa",
  "he",
  "ms",
  "no",
  "da",
  "fi",
  "fil",
  "tl",
  "ca",
  "mx",
  "la",
]);

const CONFLICTS_WITH_ARABIC = new Set([
  "en",
  "es",
  "de",
  "fr",
  "hi",
  "it",
  "pt",
  "zh",
  "ja",
  "ko",
  "ru",
  "nl",
  "pl",
  "tr",
  "sv",
  "id",
  "vi",
  "th",
  "uk",
  "cs",
  "el",
  "hu",
  "ro",
  "bg",
  "hr",
  "sk",
  "ta",
  "bn",
  "ur",
  "fa",
  "he",
  "ms",
  "no",
  "da",
  "fi",
  "fil",
  "tl",
]);

/** Blocked phrases in structured locale/language/accent values only (word-boundary). */
const BLOCKED_STRUCTURED_PHRASE_PATTERNS = [
  /\blatin\s+american\b/i,
  /\bsouth\s+american\b/i,
  /\blatino\b/i,
  /\blatina\b/i,
  /\blatam\b/i,
  /\blatin\b/i,
  /\bhispanic\b/i,
  /\bspanish\b/i,
  /\bespa[nñ]ol\b/i,
  /\bswedish\b/i,
  /\bnorwegian\b/i,
  /\bdanish\b/i,
  /\bfrench\b/i,
  /\bgerman\b/i,
  /\bitalian\b/i,
  /\bportuguese\b/i,
  /\bmultilingual\b/i,
  /\bmulti[\s-]?lingual\b/i,
  /\bpolyglot\b/i,
  /\bglobal\b/i,
  /\binternational\b/i,
  /\bversatile\b/i,
  /\bmixed\b/i,
  /\bneutral\b/i,
];

const SPANISH_LANGUAGE_PHRASES = [
  /\bspanish\b/i,
  /\bespa[nñ]ol\b/i,
  /\blatin\s+american\s+spanish\b/i,
  /\bcastilian\b/i,
];

const ENGLISH_ACCENT_LOCALE_REQUIREMENTS = {
  american: new Set(["en-us"]),
  british: new Set(["en-gb", "en-uk"]),
  australian: new Set(["en-au"]),
  indian: new Set(["en-in"]),
  neutral: new Set(["en", "en-us", "en-gb", "en-uk", "en-au", "en-in"]),
};

const ARABIC_ACCENT_REQUIRED_LOCALES = {
  "arabic-saudi": new Set(["ar-sa"]),
  "arabic-gulf": new Set(["ar-ae", "ar-kw", "ar-qa", "ar-bh", "ar-om"]),
  "arabic-egyptian": new Set(["ar-eg"]),
  "arabic-standard": new Set(["ar"]),
  "arabic-levantine": new Set(["ar-lb", "ar-sy", "ar-jo", "ar-ps"]),
};

/** Exact accent phrases allowed for English (no regex \bamerican\b on compound strings). */
const EXACT_ENGLISH_ACCENT_PHRASE = {
  american: new Set([
    "american",
    "usa",
    "us",
    "u s",
    "u.s",
    "u.s.a",
    "united states",
    "united states of america",
    "us english",
    "american english",
  ]),
  british: new Set(["british", "uk", "u k", "united kingdom", "british english", "uk english"]),
  australian: new Set(["australian", "australia", "aussie", "australian english"]),
  indian: new Set(["indian", "india", "indian english"]),
  neutral: new Set(["neutral", "generic", "international", "global"]),
};

const collectLanguageAccentProfilesFromVoice = (voice) => {
  const profiles = [];
  const addProfile = (raw) => {
    if (!raw || typeof raw !== "object") return;
    const language = String(raw.language || raw.Language || "").trim();
    const accent = String(raw.accent || raw.Accent || "").trim();
    const locale = String(raw.locale || raw.Locale || raw.language || raw.Language || "").trim();
    if (language || accent || locale) profiles.push({ language, accent, locale });
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
    const key = `${profile.language.toLowerCase()}|${profile.accent.toLowerCase()}|${profile.locale.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const collectStructuredFieldValues = (voice) => {
  const values = [];
  const push = (raw) => {
    pushFacetTokens(raw, values);
  };

  push(voice?.language);
  push(voice?.languages);
  push(voice?.locale);
  push(voice?.accent);
  if (voice?.labels && typeof voice.labels === "object") {
    for (const key of [...STRUCTURED_LANGUAGE_KEYS, ...STRUCTURED_ACCENT_KEYS]) {
      push(voice.labels[key]);
    }
  }
  for (const profile of collectLanguageAccentProfilesFromVoice(voice)) {
    push(profile.language);
    push(profile.locale);
    push(profile.accent);
  }
  return values.map((v) => String(v).trim()).filter(Boolean);
};

export const collectStructuredLocales = (voice) => {
  const locales = [];
  for (const profile of collectLanguageAccentProfilesFromVoice(voice)) {
    const tag = normalizeLocaleTag(profile.locale || profile.language);
    if (tag) locales.push(tag);
  }
  const top = normalizeLocaleTag(voice?.locale || voice?.labels?.locale);
  if (top) locales.push(top);
  for (const value of collectStructuredFieldValues(voice)) {
    const tag = normalizeLocaleTag(value);
    if (tag) locales.push(tag);
  }
  return Array.from(new Set(locales));
};

const localeLanguagePart = (tag) => String(tag || "").split("-")[0];

const collectStructuredEnglishLocaleTags = (voice) =>
  collectStructuredLocales(voice).filter((tag) => tag === "en" || tag.startsWith("en-"));

const collectStructuredArabicLocaleTags = (voice) =>
  collectStructuredLocales(voice).filter((tag) => tag === "ar" || tag.startsWith("ar-"));

const hasConflictingLocalesForLanguage = (voice, selected) => {
  const locales = collectStructuredLocales(voice);
  const conflicts =
    selected === "en"
      ? CONFLICTS_WITH_ENGLISH
      : selected === "ar"
        ? CONFLICTS_WITH_ARABIC
        : null;
  if (!conflicts) return false;
  return locales.some((tag) => {
    const lang = localeLanguagePart(tag);
    return lang && lang !== selected && conflicts.has(lang);
  });
};

const ENGLISH_ACCENT_TOKENS = ["american", "british", "australian", "indian", "neutral"];

const GENERIC_ENGLISH_ACCENT_PHRASES = new Set(["", "english", "en", "english language"]);

const isGenericEnglishAccentPhrase = (raw) => {
  const text = normalizeSearchText(raw);
  return GENERIC_ENGLISH_ACCENT_PHRASES.has(text);
};

/** Multiple regional en-* tags that disagree (e.g. en-us + en-gb). Bare `en` alone is not ambiguous. */
const hasAmbiguousEnglishLocales = (voice, accentToken) => {
  const enLocales = collectStructuredEnglishLocaleTags(voice);
  const regional = enLocales.filter((tag) => tag.includes("-"));
  if (!regional.length) return false;

  if (!accentToken) {
    return Array.from(new Set(regional)).length > 1;
  }

  const required = ENGLISH_ACCENT_LOCALE_REQUIREMENTS[accentToken];
  if (!required) return true;

  const matchingRegional = regional.filter((tag) => required.has(tag));
  const conflictingRegional = regional.filter((tag) => !required.has(tag));
  if (matchingRegional.length && conflictingRegional.length) return true;
  if (conflictingRegional.length > 1) return true;
  return false;
};

const hasStructuredEnglishAccentPhrase = (voice, accentToken) => {
  for (const value of collectStructuredFieldValues(voice)) {
    if (exactEnglishAccentFromPhrase(value, accentToken)) return true;
  }
  for (const profile of collectLanguageAccentProfilesFromVoice(voice)) {
    if (profileLanguageCode(profile) !== "en") continue;
    if (exactEnglishAccentFromPhrase(profile.accent, accentToken)) return true;
    if (exactEnglishAccentFromPhrase(profile.locale, accentToken)) return true;
    if (exactEnglishAccentFromPhrase(profile.language, accentToken)) return true;
  }
  return false;
};

const conflictingEnglishAccentPhrase = (voice, accentToken) => {
  for (const otherToken of ENGLISH_ACCENT_TOKENS) {
    if (otherToken === accentToken || otherToken === "neutral") continue;
    if (!hasStructuredEnglishAccentPhrase(voice, otherToken)) continue;
    return otherToken;
  }
  return "";
};

const canUseGenericEnglishAccentFallback = (voice, accentToken) => {
  const { codes } = detectStructuredVoiceLanguages(voice);
  if (!codes.includes("en") || !isExclusiveLanguage(codes, "en")) return false;
  if (hasBlockedStructuredPhrase(voice)) return false;
  if (hasConflictingLocalesForLanguage(voice, "en")) return false;
  if (hasAmbiguousEnglishLocales(voice, accentToken)) return false;
  if (hasOtherEnglishDialectLocale(voice, accentToken)) return false;
  if (conflictingEnglishAccentPhrase(voice, accentToken)) return false;
  return true;
};

export const hasBlockedStructuredPhrase = (voice) => {
  for (const value of collectStructuredFieldValues(voice)) {
    const text = normalizeSearchText(value);
    if (!text) continue;
    if (BLOCKED_STRUCTURED_PHRASE_PATTERNS.some((pattern) => pattern.test(text))) return true;
    if (SPANISH_LANGUAGE_PHRASES.some((pattern) => pattern.test(text))) return true;
  }
  return false;
};

const normalizeVoiceLanguageCode = (raw) => {
  const text = normalizeSearchText(raw);
  if (!text) return "";
  if (SPANISH_LANGUAGE_PHRASES.some((re) => re.test(text))) return "es";
  const tag = normalizeLocaleTag(raw);
  if (tag.startsWith("en-")) return "en";
  if (tag.length === 2 || tag.length === 3) return tag.split("-")[0];
  const normalized = normalizeLanguageFilterValue(raw);
  if (!normalized) return "";
  if (["american", "british", "indian", "australian", "neutral"].includes(normalized)) return "";
  return normalized.split("-")[0];
};

const profileLanguageCode = (profile) => {
  const tag = normalizeLocaleTag(profile?.locale || profile?.language);
  if (tag.startsWith("en-") || tag === "en") return "en";
  if (tag.includes("-")) return tag.split("-")[0];
  return normalizeVoiceLanguageCode(profile?.language || profile?.locale);
};

const exactEnglishAccentFromPhrase = (raw, allowedToken) => {
  const text = normalizeSearchText(raw);
  if (!text) return "";
  if (BLOCKED_STRUCTURED_PHRASE_PATTERNS.some((pattern) => pattern.test(text))) return "";
  if (SPANISH_LANGUAGE_PHRASES.some((pattern) => pattern.test(text))) return "";
  const allowed = EXACT_ENGLISH_ACCENT_PHRASE[allowedToken];
  if (allowed?.has(text)) return allowedToken;
  const tag = normalizeLocaleTag(raw);
  if (allowedToken === "american" && tag === "en-us") return "american";
  if (allowedToken === "british" && (tag === "en-gb" || tag === "en-uk")) return "british";
  if (allowedToken === "australian" && tag === "en-au") return "australian";
  if (allowedToken === "indian" && tag === "en-in") return "indian";
  return "";
};

/**
 * Structured language codes (locale, language fields, verified languages).
 * Does not scan name/description.
 */
export const detectStructuredVoiceLanguages = (voice) => {
  const codes = [];

  const pushCode = (raw) => {
    const code = normalizeVoiceLanguageCode(raw);
    if (code) codes.push(code);
  };

  for (const value of collectStructuredFieldValues(voice)) {
    pushCode(value);
  }

  const unique = Array.from(new Set(codes));
  return { codes: unique };
};

const isExclusiveLanguage = (codes, selected) => {
  if (!codes.length) return false;
  if (!codes.includes(selected)) return false;
  const conflicts =
    selected === "en"
      ? codes.filter((c) => c !== "en" && CONFLICTS_WITH_ENGLISH.has(c))
      : selected === "ar"
        ? codes.filter((c) => c !== "ar" && CONFLICTS_WITH_ARABIC.has(c))
        : codes.filter((c) => c !== selected);
  return conflicts.length === 0;
};

export const strictLanguageDecision = (voice, selectedLanguage) => {
  const selected = normalizeLanguageFilterValue(selectedLanguage);
  const { codes } = detectStructuredVoiceLanguages(voice);

  if (!selected) {
    return { pass: true, reason: "no-language-filter", normalizedLanguages: codes };
  }

  if (hasBlockedStructuredPhrase(voice)) {
    return { pass: false, reason: "blocked-structured-phrase", normalizedLanguages: codes };
  }

  if (!codes.length) {
    return { pass: false, reason: "unknown-language-metadata", normalizedLanguages: [] };
  }

  if (!codes.includes(selected)) {
    return {
      pass: false,
      reason: `missing-${selected}-metadata`,
      normalizedLanguages: codes,
    };
  }

  if (!isExclusiveLanguage(codes, selected)) {
    const conflicts =
      selected === "en"
        ? codes.filter((c) => c !== "en" && CONFLICTS_WITH_ENGLISH.has(c))
        : codes.filter((c) => c !== selected && CONFLICTS_WITH_ARABIC.has(c));
    return {
      pass: false,
      reason: `conflicting-language:${conflicts.join(",")}`,
      normalizedLanguages: codes,
    };
  }

  if (hasConflictingLocalesForLanguage(voice, selected)) {
    return {
      pass: false,
      reason: "conflicting-non-primary-locale",
      normalizedLanguages: codes,
    };
  }

  return {
    pass: true,
    reason: selected === "en" ? "english-exclusive" : "arabic-exclusive",
    normalizedLanguages: codes,
  };
};

const proveEnglishAccent = (voice, accentToken) => {
  const requiredLocales = ENGLISH_ACCENT_LOCALE_REQUIREMENTS[accentToken];
  if (!requiredLocales) {
    return { pass: false, reason: "unsupported-accent", normalizedAccents: [], locales: [] };
  }

  const allLocales = collectStructuredLocales(voice);
  const enLocales = collectStructuredEnglishLocaleTags(voice);

  if (hasBlockedStructuredPhrase(voice)) {
    return {
      pass: false,
      reason: "blocked-structured-phrase",
      normalizedAccents: [],
      locales: allLocales,
    };
  }

  if (hasConflictingLocalesForLanguage(voice, "en")) {
    return {
      pass: false,
      reason: "conflicting-non-english-locale",
      normalizedAccents: [],
      locales: allLocales,
    };
  }

  const otherAccent = conflictingEnglishAccentPhrase(voice, accentToken);
  if (otherAccent) {
    return {
      pass: false,
      reason: `conflicting-english-accent-phrase:${otherAccent}`,
      normalizedAccents: [],
      locales: allLocales,
    };
  }

  if (hasAmbiguousEnglishLocales(voice, accentToken)) {
    return {
      pass: false,
      reason: `ambiguous-english-locales:${enLocales.join(",")}`,
      normalizedAccents: [],
      locales: allLocales,
    };
  }

  const matchingLocales = enLocales.filter((tag) => requiredLocales.has(tag));
  if (matchingLocales.length) {
    return {
      pass: true,
      reason: `english-${accentToken}-locale-proof`,
      normalizedAccents: [accentToken],
      locales: matchingLocales,
    };
  }

  if (hasStructuredEnglishAccentPhrase(voice, accentToken)) {
    return {
      pass: true,
      reason: `english-${accentToken}-accent-phrase-fallback`,
      normalizedAccents: [accentToken],
      locales: enLocales,
    };
  }

  if (canUseGenericEnglishAccentFallback(voice, accentToken)) {
    return {
      pass: true,
      reason: `english-${accentToken}-generic-fallback`,
      normalizedAccents: [accentToken],
      locales: enLocales,
    };
  }

  if (canUseEnglishLanguagePoolFallback(voice, accentToken)) {
    return {
      pass: true,
      reason: `english-${accentToken}-language-pool-fallback`,
      normalizedAccents: [accentToken],
      locales: enLocales,
    };
  }

  return {
    pass: false,
    reason: `no-english-accent-match:${accentToken}:${enLocales.join("|")}`,
    normalizedAccents: [],
    locales: allLocales,
  };
};

export const detectStructuredVoiceAccents = (voice, selectedLanguage) => {
  const lang = normalizeLanguageFilterValue(selectedLanguage);
  if (lang !== "en") return [];
  const tokens = [];
  for (const accentToken of Object.keys(ENGLISH_ACCENT_LOCALE_REQUIREMENTS)) {
    if (accentToken === "neutral") continue;
    const proof = proveEnglishAccent(voice, accentToken);
    if (!proof.pass) continue;
    if (String(proof.reason || "").endsWith("-generic-fallback")) continue;
    tokens.push(accentToken);
  }
  return tokens;
};

const hasAmbiguousArabicLocales = (voice, accentToken) => {
  const arLocales = collectStructuredArabicLocaleTags(voice);
  const regional = arLocales.filter((tag) => tag.includes("-"));
  if (!regional.length) return false;
  if (!accentToken) return Array.from(new Set(regional)).length > 1;
  const required = ARABIC_ACCENT_REQUIRED_LOCALES[accentToken];
  if (!required) return true;
  const matchingRegional = regional.filter((tag) => required.has(tag));
  const conflictingRegional = regional.filter((tag) => !required.has(tag));
  if (matchingRegional.length && conflictingRegional.length) return true;
  if (conflictingRegional.length > 1) return true;
  return false;
};

const structuredValueMatchesArabicAlias = (raw, alias, accentToken) => {
  const text = normalizeSearchText(raw);
  if (!text) return false;
  if ((alias.keywords || []).includes(text)) return true;
  const tag = normalizeLocaleTag(raw);
  if (tag && ARABIC_ACCENT_REQUIRED_LOCALES[accentToken]?.has(tag)) return true;
  if (alias.patterns?.some((pattern) => pattern.test(text))) return true;
  return false;
};

const hasStructuredArabicAccentPhrase = (voice, accentToken) => {
  const alias = ARABIC_ACCENT_ALIASES.find((entry) => entry.token === accentToken);
  if (!alias) return false;
  for (const value of collectStructuredFieldValues(voice)) {
    if (structuredValueMatchesArabicAlias(value, alias, accentToken)) return true;
  }
  for (const profile of collectLanguageAccentProfilesFromVoice(voice)) {
    if (profileLanguageCode(profile) !== "ar") continue;
    if (structuredValueMatchesArabicAlias(profile.accent, alias, accentToken)) return true;
    if (structuredValueMatchesArabicAlias(profile.locale, alias, accentToken)) return true;
    if (structuredValueMatchesArabicAlias(profile.language, alias, accentToken)) return true;
  }
  return false;
};

const conflictingArabicAccentPhrase = (voice, accentToken) => {
  for (const alias of ARABIC_ACCENT_ALIASES) {
    if (alias.token === accentToken) continue;
    if (hasStructuredArabicAccentPhrase(voice, alias.token)) return alias.token;
  }
  return "";
};

const otherArabicDialectLocaleTags = (accentToken) => {
  const out = new Set();
  for (const [token, locales] of Object.entries(ARABIC_ACCENT_REQUIRED_LOCALES)) {
    if (token === accentToken) continue;
    for (const loc of locales) out.add(loc);
  }
  return out;
};

const hasOtherArabicDialectLocale = (voice, accentToken) => {
  const other = otherArabicDialectLocaleTags(accentToken);
  const regional = collectStructuredArabicLocaleTags(voice).filter((tag) => tag.includes("-"));
  return regional.some((tag) => other.has(tag));
};

const otherEnglishDialectLocaleTags = (accentToken) => {
  const out = new Set();
  for (const [token, locales] of Object.entries(ENGLISH_ACCENT_LOCALE_REQUIREMENTS)) {
    if (token === accentToken || token === "neutral") continue;
    for (const loc of locales) out.add(loc);
  }
  return out;
};

const hasOtherEnglishDialectLocale = (voice, accentToken) => {
  const other = otherEnglishDialectLocaleTags(accentToken);
  const regional = collectStructuredEnglishLocaleTags(voice).filter((tag) => tag.includes("-"));
  return regional.some((tag) => other.has(tag));
};

const canUseGenericArabicAccentFallback = (voice, accentToken) => {
  const { codes } = detectStructuredVoiceLanguages(voice);
  if (!codes.includes("ar") || !isExclusiveLanguage(codes, "ar")) return false;
  if (hasBlockedStructuredPhrase(voice)) return false;
  if (hasConflictingLocalesForLanguage(voice, "ar")) return false;
  if (hasAmbiguousArabicLocales(voice, accentToken)) return false;
  if (hasOtherArabicDialectLocale(voice, accentToken)) return false;
  if (conflictingArabicAccentPhrase(voice, accentToken)) return false;
  return true;
};

const canUseArabicLanguagePoolFallback = (voice, accentToken) => {
  const { codes } = detectStructuredVoiceLanguages(voice);
  if (!codes.includes("ar") || !isExclusiveLanguage(codes, "ar")) return false;
  if (hasBlockedStructuredPhrase(voice)) return false;
  if (hasConflictingLocalesForLanguage(voice, "ar")) return false;
  if (conflictingArabicAccentPhrase(voice, accentToken)) return false;
  if (hasOtherArabicDialectLocale(voice, accentToken)) return false;
  return true;
};

const canUseEnglishLanguagePoolFallback = (voice, accentToken) => {
  const { codes } = detectStructuredVoiceLanguages(voice);
  if (!codes.includes("en") || !isExclusiveLanguage(codes, "en")) return false;
  if (hasBlockedStructuredPhrase(voice)) return false;
  if (hasConflictingLocalesForLanguage(voice, "en")) return false;
  if (conflictingEnglishAccentPhrase(voice, accentToken)) return false;
  if (hasOtherEnglishDialectLocale(voice, accentToken)) return false;
  return true;
};

const proveArabicAccent = (voice, accentToken) => {
  if (accentToken === "arabic-general") {
    const allLocales = collectStructuredLocales(voice);
    if (!voiceMatchesLanguageForAvailability(voice, "ar")) {
      return {
        pass: false,
        reason: "not-arabic-for-general",
        normalizedAccents: [],
        locales: allLocales,
      };
    }
    if (hasBlockedStructuredPhrase(voice)) {
      return {
        pass: false,
        reason: "blocked-structured-phrase",
        normalizedAccents: [],
        locales: allLocales,
      };
    }
    if (hasConflictingLocalesForLanguage(voice, "ar")) {
      return {
        pass: false,
        reason: "conflicting-non-arabic-locale",
        normalizedAccents: [],
        locales: allLocales,
      };
    }
    return {
      pass: true,
      reason: "arabic-general-language-pool-fallback",
      normalizedAccents: ["arabic-general"],
      locales: collectStructuredArabicLocaleTags(voice),
    };
  }

  const requiredLocales = ARABIC_ACCENT_REQUIRED_LOCALES[accentToken];
  if (!requiredLocales) {
    return { pass: false, reason: "unsupported-arabic-accent", normalizedAccents: [], locales: [] };
  }

  const allLocales = collectStructuredLocales(voice);
  const arLocales = collectStructuredArabicLocaleTags(voice);

  if (hasBlockedStructuredPhrase(voice)) {
    return {
      pass: false,
      reason: "blocked-structured-phrase",
      normalizedAccents: [],
      locales: allLocales,
    };
  }

  if (hasConflictingLocalesForLanguage(voice, "ar")) {
    return {
      pass: false,
      reason: "conflicting-non-arabic-locale",
      normalizedAccents: [],
      locales: allLocales,
    };
  }

  const otherDialect = conflictingArabicAccentPhrase(voice, accentToken);
  if (otherDialect) {
    return {
      pass: false,
      reason: `conflicting-arabic-accent-phrase:${otherDialect}`,
      normalizedAccents: [],
      locales: allLocales,
    };
  }

  if (hasAmbiguousArabicLocales(voice, accentToken)) {
    return {
      pass: false,
      reason: `ambiguous-arabic-locales:${arLocales.join(",")}`,
      normalizedAccents: [],
      locales: allLocales,
    };
  }

  const matchingLocales = arLocales.filter((tag) => requiredLocales.has(tag));
  if (matchingLocales.length) {
    return {
      pass: true,
      reason: `arabic-${accentToken}-locale-proof`,
      normalizedAccents: [accentToken],
      locales: matchingLocales,
    };
  }

  if (hasStructuredArabicAccentPhrase(voice, accentToken)) {
    return {
      pass: true,
      reason: `arabic-${accentToken}-accent-phrase-fallback`,
      normalizedAccents: [accentToken],
      locales: arLocales,
    };
  }

  if (canUseGenericArabicAccentFallback(voice, accentToken)) {
    return {
      pass: true,
      reason: `arabic-${accentToken}-generic-fallback`,
      normalizedAccents: [accentToken],
      locales: arLocales,
    };
  }

  if (canUseArabicLanguagePoolFallback(voice, accentToken)) {
    return {
      pass: true,
      reason: `arabic-${accentToken}-language-pool-fallback`,
      normalizedAccents: [accentToken],
      locales: arLocales,
    };
  }

  return {
    pass: false,
    reason: `no-arabic-accent-match:${accentToken}:${arLocales.join("|")}`,
    normalizedAccents: [],
    locales: allLocales,
  };
};

export const strictAccentDecision = (voice, selectedLanguage, selectedAccent) => {
  const lang = normalizeLanguageFilterValue(selectedLanguage);
  const accentToken = selectedAccent ? normalizeAccentToken(selectedAccent) : "";

  if (!accentToken) {
    return {
      pass: true,
      reason: "no-accent-filter",
      normalizedAccents: [],
      locales: collectStructuredLocales(voice),
    };
  }

  if (hasBlockedStructuredPhrase(voice)) {
    return {
      pass: false,
      reason: "blocked-structured-phrase",
      normalizedAccents: [],
      locales: collectStructuredLocales(voice),
    };
  }

  if (lang === "en") {
    if (!EXACT_ENGLISH_ACCENT_PHRASE[accentToken]) {
      return {
        pass: false,
        reason: "unsupported-english-accent",
        normalizedAccents: [],
        locales: collectStructuredLocales(voice),
      };
    }
    const proof = proveEnglishAccent(voice, accentToken);
    return {
      pass: proof.pass,
      reason: proof.reason,
      normalizedAccents: proof.normalizedAccents,
      locales: proof.locales,
    };
  }

  if (lang === "ar") {
    if (!ARABIC_DIALECT_ACCENT_TOKENS.has(accentToken)) {
      return {
        pass: false,
        reason: "unsupported-arabic-accent",
        normalizedAccents: [],
        locales: collectStructuredLocales(voice),
      };
    }
    const proof = proveArabicAccent(voice, accentToken);
    return {
      pass: proof.pass,
      reason: proof.reason,
      normalizedAccents: proof.normalizedAccents,
      locales: proof.locales,
    };
  }

  return {
    pass: false,
    reason: "accent-filter-unsupported-language",
    normalizedAccents: [],
    locales: collectStructuredLocales(voice),
  };
};

export const voiceDebugLabel = (voice) =>
  voice?.name || voice?.displayName || voice?.providerVoiceId || voice?.voiceId || voice?.id || "unknown voice";

/** Relaxed Arabic/English check for accent dropdown availability (catalog labels without BCP-47). */
export const voiceMatchesLanguageForAvailability = (voice, selectedLanguage) => {
  const selected = normalizeLanguageFilterValue(selectedLanguage);
  if (!selected) return true;

  const strict = strictLanguageDecision(voice, selected);
  if (strict.pass) return true;

  if (hasBlockedStructuredPhrase(voice)) return false;
  if (hasConflictingLocalesForLanguage(voice, selected)) return false;

  const { codes } = detectStructuredVoiceLanguages(voice);
  if (codes.includes(selected) && isExclusiveLanguage(codes, selected)) return true;

  for (const value of collectStructuredFieldValues(voice)) {
    if (normalizeLanguageFilterValue(value) === selected) return true;
  }

  return false;
};

export const sampleVoiceLanguageAccentMetadata = (voice) => ({
  name: voiceDebugLabel(voice),
  language: voice?.language || voice?.labels?.language || "",
  languages: voice?.languages || [],
  locale: voice?.locale || voice?.labels?.locale || "",
  accent: voice?.accent || voice?.labels?.accent || "",
  languageAccents: voice?.languageAccents || voice?.languageAccentPairs || [],
});
