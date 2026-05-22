import { normalizeLanguageFilterValue } from "../components/voiceFilterLanguage";
import {
  ARABIC_ACCENT_ALIASES,
  ARABIC_DIALECT_ACCENT_TOKENS,
  CANONICAL_ACCENT_LOOKUP,
  ENGLISH_ACCENT_ALIASES,
  normalizeAccentSearchText,
  normalizeAccentToken,
} from "./voiceAccentConstants";
import {
  detectStructuredVoiceAccents,
  strictAccentDecision,
  strictLanguageDecision,
} from "./strictVoiceMetadata";
import {
  buildAvailableAccentOptionsForLanguage,
  countVoicesForAccentOption,
} from "./voiceFilterAvailability";

const ARABIC_ACCENT_ALIAS_BY_TOKEN = new Map(ARABIC_ACCENT_ALIASES.map((alias) => [alias.token, alias]));
const ENGLISH_ACCENT_ALIAS_BY_TOKEN = new Map(ENGLISH_ACCENT_ALIASES.map((alias) => [alias.token, alias]));

export {
  ARABIC_ACCENT_ALIASES,
  ENGLISH_ACCENT_ALIASES,
  normalizeAccentToken,
  normalizeAccentSearchText,
  CANONICAL_ACCENT_LOOKUP,
};

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

const stripArabicAccentLabelPrefix = (display) =>
  String(display || "")
    .trim()
    .replace(/^arabic\s*[-–—:]\s*/i, "");

const formatAccentDisplayForLanguage = (display, language) => {
  const cleaned = stripArabicAccentLabelPrefix(display);
  if (normalizeLanguageFilterValue(language) !== "ar") return cleaned;
  const token = normalizeAccentToken(cleaned);
  const alias =
    ARABIC_ACCENT_ALIAS_BY_TOKEN.get(token) || ENGLISH_ACCENT_ALIAS_BY_TOKEN.get(token);
  return alias?.display || cleaned;
};

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

export const languageMatchesVoice = (language, voice) =>
  strictLanguageDecision(voice, language).pass;

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

/** Accent labels for a voice scoped to a language (display casing preserved). */
export const accentDisplaysForLanguageFromVoice = (voice, language) => {
  const normalizedLanguage = normalizeLanguageFilterValue(language);
  if (!strictLanguageDecision(voice, normalizedLanguage).pass) return [];
  const tokens = detectStructuredVoiceAccents(voice, normalizedLanguage);
  return uniqueSortedDisplay(
    tokens.map((token) => {
      const alias =
        ARABIC_ACCENT_ALIAS_BY_TOKEN.get(token) || ENGLISH_ACCENT_ALIAS_BY_TOKEN.get(token);
      return alias?.display || formatAccentDisplay(token);
    })
  );
};

/** Lowercase accent tokens used when applying the accent filter (must match filter logic). */
export const accentTokensForLanguageFromVoice = (voice, language) =>
  detectStructuredVoiceAccents(voice, language);

export const rankVoiceForAccentForLanguage = (voice, language, accentValue) => {
  const accentToken = normalizeAccentToken(accentValue);
  const normalizedLanguage = normalizeLanguageFilterValue(language) || languageForAccentValue(accentToken);
  if (!accentToken) {
    const langDecision = strictLanguageDecision(voice, normalizedLanguage);
    return {
      include: langDecision.pass,
      score: langDecision.pass ? 0 : 0,
      rank: 0,
      normalizedAccent: "",
      reason: langDecision.reason,
    };
  }
  const langDecision = strictLanguageDecision(voice, normalizedLanguage);
  if (!langDecision.pass) {
    return {
      include: false,
      score: 0,
      rank: 0,
      normalizedAccent: accentToken,
      reason: langDecision.reason,
    };
  }
  const accentDecision = strictAccentDecision(voice, normalizedLanguage, accentToken);
  return {
    include: accentDecision.pass,
    score: accentDecision.pass ? 100 : 0,
    rank: accentDecision.pass ? 4 : 0,
    normalizedAccent: accentToken,
    detectedTokens: accentDecision.normalizedAccents,
    detectedAccent: accentDecision.normalizedAccents.join(", "),
    reason: accentDecision.reason,
  };
};

export const rankVoicesForAccentForLanguage = (voices, language, accentValue) => {
  const accentToken = normalizeAccentToken(accentValue);
  const normalizedLanguage = normalizeLanguageFilterValue(language);
  if (!accentToken) {
    return (voices || []).filter((voice) => strictLanguageDecision(voice, normalizedLanguage).pass);
  }
  return (voices || []).filter((voice) => {
    const langOk = strictLanguageDecision(voice, normalizedLanguage).pass;
    const accentOk = strictAccentDecision(voice, normalizedLanguage, accentToken).pass;
    return langOk && accentOk;
  });
};

/** True when this voice matches language + accent using the same rules as client-side filtering. */
export const voiceMatchesAccentForLanguage = (voice, language, accentValue) =>
  rankVoiceForAccentForLanguage(voice, language, accentValue).include;

/**
 * Build accent dropdown options for a language from catalog availability (no hardcoded lists).
 */
/** Accent options from catalog availability (gender not applied — see voiceFilterAvailability). */
export const buildAccentOptionsForLanguage = (voices, language, defaultLanguage = "en") =>
  buildAvailableAccentOptionsForLanguage(voices, language, defaultLanguage);

export const countVoicesMatchingAccentForLanguage = (voices, language, accentValue, options = {}) => {
  const normalizedLanguage = normalizeLanguageFilterValue(language);
  const accentToken = normalizeAccentToken(accentValue);
  if (!accentToken) {
    return (voices || []).filter((voice) => languageMatchesVoice(normalizedLanguage, voice)).length;
  }
  return countVoicesForAccentOption(voices, normalizedLanguage, accentToken, options);
};
