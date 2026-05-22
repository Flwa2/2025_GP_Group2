import { normalizeLanguageFilterValue } from "../components/voiceFilterLanguage";
import {
  ARABIC_ACCENT_ALIASES,
  ENGLISH_ACCENT_ALIASES,
  ENGLISH_ACCENT_TOKENS,
  normalizeAccentToken,
} from "./voiceAccentConstants";

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

const normalizeSearchText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

/** Language codes that must not appear when filtering English. */
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
]);

/** Language codes that must not appear when filtering Arabic. */
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

const SPANISH_LANGUAGE_PHRASES = [
  /\bspanish\b/i,
  /\bespa[nñ]ol\b/i,
  /\blatin\s+american\s+spanish\b/i,
  /\bcastilian\b/i,
];

const LOCALE_ENGLISH_ACCENT = [
  { pattern: /\ben[-_\s]?us\b/i, token: "american" },
  { pattern: /\ben[-_\s]?gb\b/i, token: "british" },
  { pattern: /\ben[-_\s]?uk\b/i, token: "british" },
  { pattern: /\ben[-_\s]?au\b/i, token: "australian" },
  { pattern: /\ben[-_\s]?in\b/i, token: "indian" },
];

const collectLanguageAccentProfilesFromVoice = (voice) => {
  const profiles = [];
  const addProfile = (raw) => {
    if (!raw || typeof raw !== "object") return;
    const language = String(raw.language || raw.Language || raw.locale || raw.Locale || "").trim();
    const accent = String(raw.accent || raw.Accent || "").trim();
    if (language || accent) profiles.push({ language, accent, locale: String(raw.locale || raw.Locale || "").trim() });
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

  return profiles;
};

const normalizeVoiceLanguageCode = (raw) => {
  const text = normalizeSearchText(raw);
  if (!text) return "";
  if (SPANISH_LANGUAGE_PHRASES.some((re) => re.test(text))) return "es";
  const normalized = normalizeLanguageFilterValue(raw);
  if (!normalized) return "";
  if (normalized === "american" || normalized === "british" || normalized === "indian") return "";
  return normalized.split("-")[0];
};

const localeImpliesEnglishAccent = (localeRaw) => {
  const locale = normalizeSearchText(localeRaw);
  if (!locale) return "";
  const hit = LOCALE_ENGLISH_ACCENT.find((entry) => entry.pattern.test(locale));
  return hit?.token || "";
};

const profileLanguageCode = (profile) => {
  const fromLang = normalizeVoiceLanguageCode(profile?.language);
  if (fromLang) return fromLang;
  return normalizeVoiceLanguageCode(profile?.locale);
};

const isSpanishPhrase = (text) => {
  const normalized = normalizeSearchText(text);
  if (!normalized) return false;
  return SPANISH_LANGUAGE_PHRASES.some((re) => re.test(normalized));
};

const normalizeEnglishAccentFromText = (raw) => {
  const text = normalizeSearchText(raw);
  if (!text || isSpanishPhrase(text)) return "";
  if (/\bspanish\b/.test(text) || /\blatin\s+american\b/.test(text)) return "";
  return normalizeAccentToken(raw);
};

const normalizeArabicAccentFromText = (raw) => normalizeAccentToken(raw);

const localeImpliesArabicAccent = (localeRaw) => {
  const locale = normalizeSearchText(localeRaw);
  if (!locale) return "";
  const hit = ARABIC_ACCENT_ALIASES.find((alias) =>
    alias.localePatterns?.some((pattern) => pattern.test(locale))
  );
  return hit?.token || "";
};

/**
 * Structured language codes for a voice (locale, language fields, verified languages).
 * Does not scan free-text description/name haystacks.
 */
export const detectStructuredVoiceLanguages = (voice) => {
  const codes = [];
  const sources = [];

  const pushCode = (raw, source) => {
    const code = normalizeVoiceLanguageCode(raw);
    if (!code) return;
    codes.push(code);
    sources.push({ code, source, raw: String(raw || "").trim() });
  };

  const languageBucket = [];
  pushFacetTokens(voice?.language, languageBucket);
  pushFacetTokens(voice?.languages, languageBucket);
  pushFacetTokens(voice?.locale, languageBucket);
  if (voice?.labels && typeof voice.labels === "object") {
    pushFacetTokens(voice.labels.language, languageBucket);
    pushFacetTokens(voice.labels.Language, languageBucket);
    pushFacetTokens(voice.labels.languages, languageBucket);
    pushFacetTokens(voice.labels.locale, languageBucket);
    pushFacetTokens(voice.labels.Locale, languageBucket);
  }
  languageBucket.forEach((t) => pushCode(t, "structured-language"));

  for (const profile of collectLanguageAccentProfilesFromVoice(voice)) {
    const code = profileLanguageCode(profile);
    if (code) sources.push({ code, source: "profile", raw: profile.language || profile.locale });
    if (code) codes.push(code);
  }

  const unique = Array.from(new Set(codes));
  return { codes: unique, sources };
};

export const strictLanguageDecision = (voice, selectedLanguage) => {
  const selected = normalizeLanguageFilterValue(selectedLanguage);
  const { codes } = detectStructuredVoiceLanguages(voice);

  if (!selected) {
    return {
      pass: true,
      reason: "no-language-filter",
      normalizedLanguages: codes,
    };
  }

  if (!codes.length) {
    return {
      pass: false,
      reason: "unknown-language-metadata",
      normalizedLanguages: [],
    };
  }

  if (selected === "en") {
    if (!codes.includes("en")) {
      return {
        pass: false,
        reason: "missing-english-metadata",
        normalizedLanguages: codes,
      };
    }
    const conflicts = codes.filter((code) => code !== "en" && CONFLICTS_WITH_ENGLISH.has(code));
    if (conflicts.length) {
      return {
        pass: false,
        reason: `conflicting-language:${conflicts.join(",")}`,
        normalizedLanguages: codes,
      };
    }
    return {
      pass: true,
      reason: "english-exact",
      normalizedLanguages: codes,
    };
  }

  if (selected === "ar") {
    if (!codes.includes("ar")) {
      return {
        pass: false,
        reason: "missing-arabic-metadata",
        normalizedLanguages: codes,
      };
    }
    const conflicts = codes.filter((code) => code !== "ar" && CONFLICTS_WITH_ARABIC.has(code));
    if (conflicts.length) {
      return {
        pass: false,
        reason: `conflicting-language:${conflicts.join(",")}`,
        normalizedLanguages: codes,
      };
    }
    return {
      pass: true,
      reason: "arabic-exact",
      normalizedLanguages: codes,
    };
  }

  const matches = codes.includes(selected);
  return {
    pass: matches,
    reason: matches ? "language-exact" : "language-mismatch",
    normalizedLanguages: codes,
  };
};

const detectEnglishAccentTokens = (voice) => {
  const tokens = [];
  const profiles = collectLanguageAccentProfilesFromVoice(voice);

  for (const profile of profiles) {
    const lang = profileLanguageCode(profile);
    if (lang && lang !== "en") continue;

    const fromLocale = localeImpliesEnglishAccent(profile.locale || profile.language);
    if (fromLocale) tokens.push(fromLocale);

    if (profile.accent) {
      const token = normalizeEnglishAccentFromText(profile.accent);
      if (token) tokens.push(token);
    }
  }

  const accentBucket = [];
  pushFacetTokens(voice?.accent, accentBucket);
  if (voice?.labels && typeof voice.labels === "object") {
    pushFacetTokens(voice.labels.accent, accentBucket);
    pushFacetTokens(voice.labels.Accent, accentBucket);
  }
  const langCodes = detectStructuredVoiceLanguages(voice).codes;
  if (langCodes.includes("en") && langCodes.every((c) => c === "en")) {
    accentBucket.forEach((raw) => {
      const token = normalizeEnglishAccentFromText(raw);
      if (token) tokens.push(token);
    });
  }

  const topLocale = localeImpliesEnglishAccent(voice?.locale || voice?.labels?.locale);
  if (topLocale && detectStructuredVoiceLanguages(voice).codes.every((c) => c === "en")) {
    tokens.push(topLocale);
  }

  return Array.from(new Set(tokens.filter((t) => ENGLISH_ACCENT_TOKENS.has(t))));
};

const detectArabicAccentTokens = (voice) => {
  const tokens = [];
  const profiles = collectLanguageAccentProfilesFromVoice(voice);

  for (const profile of profiles) {
    const lang = profileLanguageCode(profile);
    if (lang && lang !== "ar") continue;

    const fromLocale = localeImpliesArabicAccent(profile.locale || profile.language);
    if (fromLocale) tokens.push(fromLocale);

    if (profile.accent) {
      const token = normalizeArabicAccentFromText(profile.accent);
      if (token && ARABIC_ACCENT_ALIASES.some((a) => a.token === token)) tokens.push(token);
    }
  }

  const langCodes = detectStructuredVoiceLanguages(voice).codes;
  if (langCodes.includes("ar") && langCodes.every((c) => c === "ar")) {
    const arAccentBucket = [];
    pushFacetTokens(voice?.accent, arAccentBucket);
    if (voice?.labels && typeof voice.labels === "object") {
      pushFacetTokens(voice.labels.accent, arAccentBucket);
      pushFacetTokens(voice.labels.Accent, arAccentBucket);
    }
    arAccentBucket.forEach((raw) => {
      const token = normalizeArabicAccentFromText(raw);
      if (token && ARABIC_ACCENT_ALIASES.some((a) => a.token === token)) tokens.push(token);
    });
    const topLocale = localeImpliesArabicAccent(voice?.locale || voice?.labels?.locale);
    if (topLocale) tokens.push(topLocale);
  }

  return Array.from(new Set(tokens));
};

export const detectStructuredVoiceAccents = (voice, selectedLanguage) => {
  const lang = normalizeLanguageFilterValue(selectedLanguage);
  if (lang === "en") return detectEnglishAccentTokens(voice);
  if (lang === "ar") return detectArabicAccentTokens(voice);
  return [];
};

export const strictAccentDecision = (voice, selectedLanguage, selectedAccent) => {
  const lang = normalizeLanguageFilterValue(selectedLanguage);
  const accentToken = selectedAccent ? normalizeAccentToken(selectedAccent) : "";

  if (!accentToken) {
    return {
      pass: true,
      reason: "no-accent-filter",
      normalizedAccents: [],
    };
  }

  const tokens = detectStructuredVoiceAccents(voice, lang);

  if (!tokens.length) {
    return {
      pass: false,
      reason: "unknown-accent-metadata",
      normalizedAccents: [],
    };
  }

  if (tokens.length > 1) {
    return {
      pass: false,
      reason: `ambiguous-accent:${tokens.join(",")}`,
      normalizedAccents: tokens,
    };
  }

  if (tokens[0] !== accentToken) {
    return {
      pass: false,
      reason: `accent-mismatch:expected-${accentToken}-got-${tokens[0]}`,
      normalizedAccents: tokens,
    };
  }

  return {
    pass: true,
    reason: "accent-exact",
    normalizedAccents: tokens,
  };
};

export const voiceDebugLabel = (voice) =>
  voice?.name || voice?.displayName || voice?.providerVoiceId || voice?.voiceId || voice?.id || "unknown voice";
