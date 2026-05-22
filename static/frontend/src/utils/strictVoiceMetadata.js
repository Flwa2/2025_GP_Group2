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

/** Normalize BCP-47-ish tags to `en-us`, `en`, `es`, `sv-se`, etc. */
export const normalizeLocaleTag = (raw) => {
  const trimmed = String(raw || "").trim().toLowerCase().replace(/_/g, "-");
  if (!trimmed) return "";
  const match = trimmed.match(/^([a-z]{2,3})(?:[-]([a-z]{2,4}))?$/);
  if (match) {
    const lang = match[1];
    const region = match[2] || "";
    return region ? `${lang}-${region}` : lang;
  }
  return normalizeSearchText(trimmed).replace(/\s+/g, "-");
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
  neutral: new Set(["en", "en-us", "en-gb", "en-au", "en-in"]),
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
  return Array.from(new Set(locales));
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

  return {
    pass: true,
    reason: selected === "en" ? "english-exclusive" : "arabic-exclusive",
    normalizedLanguages: codes,
  };
};

const proveEnglishAccent = (voice, accentToken) => {
  const profiles = collectLanguageAccentProfilesFromVoice(voice);
  const enProfiles = profiles.filter((p) => profileLanguageCode(p) === "en");
  if (!enProfiles.length) {
    return { pass: false, reason: "no-english-profile", normalizedAccents: [], locales: [] };
  }

  const requiredLocales = ENGLISH_ACCENT_LOCALE_REQUIREMENTS[accentToken];
  if (!requiredLocales) {
    return { pass: false, reason: "unsupported-accent", normalizedAccents: [], locales: [] };
  }

  const profileProofs = [];
  for (const profile of enProfiles) {
    const localeTag = normalizeLocaleTag(profile.locale || profile.language);
    if (!localeTag) continue;
    if (!requiredLocales.has(localeTag)) continue;

    const accentPhrase = profile.accent ? exactEnglishAccentFromPhrase(profile.accent, accentToken) : "";
    if (profile.accent && !accentPhrase) {
      continue;
    }

    profileProofs.push({ localeTag, accentPhrase: accentPhrase || accentToken });
  }

  if (!profileProofs.length) {
    const locales = collectStructuredLocales(voice);
    return {
      pass: false,
      reason: `missing-required-locale:${accentToken}:${locales.join("|")}`,
      normalizedAccents: [],
      locales,
    };
  }

  const enLocaleTags = enProfiles
    .map((p) => normalizeLocaleTag(p.locale || p.language))
    .filter(Boolean);
  const uniqueEnLocales = Array.from(new Set(enLocaleTags));

  if (accentToken !== "neutral" && uniqueEnLocales.length > 1) {
    const matchingLocales = profileProofs.map((p) => p.localeTag);
    const nonMatching = uniqueEnLocales.filter((l) => !matchingLocales.includes(l));
    if (nonMatching.length) {
      return {
        pass: false,
        reason: `ambiguous-english-locales:${uniqueEnLocales.join(",")}`,
        normalizedAccents: [accentToken],
        locales: uniqueEnLocales,
      };
    }
  }

  return {
    pass: true,
    reason: `english-${accentToken}-locale-proof`,
    normalizedAccents: [accentToken],
    locales: profileProofs.map((p) => p.localeTag),
  };
};

export const detectStructuredVoiceAccents = (voice, selectedLanguage) => {
  const lang = normalizeLanguageFilterValue(selectedLanguage);
  if (lang !== "en") return [];
  const tokens = [];
  for (const accentToken of Object.keys(ENGLISH_ACCENT_LOCALE_REQUIREMENTS)) {
    if (accentToken === "neutral") continue;
    if (proveEnglishAccent(voice, accentToken).pass) tokens.push(accentToken);
  }
  return tokens;
};

const proveArabicAccent = (voice, accentToken) => {
  const alias = ARABIC_ACCENT_ALIASES.find((entry) => entry.token === accentToken);
  if (!alias) {
    return { pass: false, reason: "unsupported-arabic-accent", normalizedAccents: [], locales: [] };
  }

  const profiles = collectLanguageAccentProfilesFromVoice(voice).filter(
    (p) => profileLanguageCode(p) === "ar"
  );
  if (!profiles.length) {
    return { pass: false, reason: "no-arabic-profile", normalizedAccents: [], locales: [] };
  }

  const matchingProfiles = profiles.filter((profile) => {
    const localeRaw = normalizeSearchText(profile.locale || profile.language);
    if (!localeRaw) return false;
    return alias.localePatterns?.some((pattern) => pattern.test(localeRaw)) || false;
  });

  const locales = collectStructuredLocales(voice);
  if (!matchingProfiles.length) {
    return {
      pass: false,
      reason: `missing-arabic-locale:${accentToken}`,
      normalizedAccents: [],
      locales,
    };
  }

  const arLocaleTags = profiles
    .map((p) => normalizeLocaleTag(p.locale || p.language))
    .filter((l) => l.startsWith("ar"));
  const uniqueArLocales = Array.from(new Set(arLocaleTags));
  const proofLocales = matchingProfiles.map((p) => normalizeLocaleTag(p.locale || p.language));
  const extraLocales = uniqueArLocales.filter((l) => !proofLocales.includes(l));
  if (extraLocales.length) {
    return {
      pass: false,
      reason: `ambiguous-arabic-locales:${uniqueArLocales.join(",")}`,
      normalizedAccents: [accentToken],
      locales: uniqueArLocales,
    };
  }

  return {
    pass: true,
    reason: `arabic-${accentToken}-locale-proof`,
    normalizedAccents: [accentToken],
    locales: proofLocales,
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
