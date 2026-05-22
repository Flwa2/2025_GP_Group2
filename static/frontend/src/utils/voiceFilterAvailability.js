import { normalizeLanguageFilterValue } from "../components/voiceFilterLanguage";
import {
  ARABIC_ACCENT_ALIASES,
  ARABIC_GENERAL_DISPLAY,
  ENGLISH_ACCENT_ALIASES,
  normalizeAccentToken,
} from "./voiceAccentConstants";
import { normalizeGenderToken } from "./voiceGender";
import {
  sampleVoiceLanguageAccentMetadata,
  strictAccentDecision,
  strictLanguageDecision,
  voiceDebugLabel,
  voiceMatchesLanguageForAvailability,
} from "./strictVoiceMetadata";
import { strictVoiceMatchesLanguageAccent, shouldLogStrictVoiceFilter } from "./strictVoiceFilter";
import { catalogCacheKey } from "./voiceCatalogCacheKey";

/** Bump when accent availability logic changes (visible in [ARABIC ACCENT OPTIONS] logs). */
export const VOICE_FILTER_BUILD_TAG = "arabic-accent-v3-5ab0bfe+";

const uniqueSortedDisplay = (displays) =>
  Array.from(new Set(displays.map((x) => String(x).trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

const ACCENT_ALIASES_BY_LANGUAGE = {
  ar: ARABIC_ACCENT_ALIASES,
  en: ENGLISH_ACCENT_ALIASES,
};

const ARABIC_DIALECT_DISPLAYS = ARABIC_ACCENT_ALIASES.filter((a) => a.token !== "neutral").map(
  (a) => a.display
);

let accentAvailabilityCache = { catalogKey: "", map: null, arabicVoiceCount: 0 };

/** Invalidate when voice catalog is replaced (e.g. after fetch). */
export const invalidateAccentAvailabilityCache = () => {
  accentAvailabilityCache = { catalogKey: "", map: null, arabicVoiceCount: 0 };
};

export const countVoicesMatchingLanguageForAvailability = (voices, language) => {
  const lang = normalizeLanguageFilterValue(language);
  if (!lang) return 0;
  let count = 0;
  for (const voice of voices || []) {
    if (voiceMatchesLanguageForAvailability(voice, lang)) count += 1;
  }
  return count;
};

/**
 * One pass per catalog: count voices per language+accent (gender excluded).
 * Uses relaxed language match so Arabic labels without BCP-47 still count.
 */
export const getAccentAvailabilityMap = (voices) => {
  const key = catalogCacheKey(voices);
  if (accentAvailabilityCache.catalogKey === key && accentAvailabilityCache.map) {
    return accentAvailabilityCache.map;
  }

  const map = new Map();
  let arabicVoiceCount = 0;

  for (const voice of voices || []) {
    for (const lang of Object.keys(ACCENT_ALIASES_BY_LANGUAGE)) {
      if (!voiceMatchesLanguageForAvailability(voice, lang)) continue;
      if (lang === "ar") arabicVoiceCount += 1;

      for (const alias of ACCENT_ALIASES_BY_LANGUAGE[lang]) {
        if (alias.token === "neutral") continue;
        const accentDecision = strictAccentDecision(voice, lang, alias.token);
        if (!accentDecision.pass) continue;
        const mapKey = `${lang}|${alias.display}`;
        map.set(mapKey, (map.get(mapKey) || 0) + 1);
      }
    }
  }

  accentAvailabilityCache = { catalogKey: key, map, arabicVoiceCount };
  return map;
};

export const getCachedArabicVoiceCount = (voices) => {
  getAccentAvailabilityMap(voices);
  return accentAvailabilityCache.arabicVoiceCount || 0;
};

const buildArabicAccentOptions = (voices) => {
  const arabicVoiceCount = countVoicesMatchingLanguageForAvailability(voices, "ar");
  if (!arabicVoiceCount) return [];

  // Catalog has Arabic voices → always offer dialect labels + Arabic General (filtering uses safe fallbacks per accent).
  return uniqueSortedDisplay([...ARABIC_DIALECT_DISPLAYS, ARABIC_GENERAL_DISPLAY]);
};

export const buildAvailableAccentOptionsForLanguage = (
  voices,
  language,
  defaultLanguage = "en"
) => {
  const normalizedLanguage = normalizeLanguageFilterValue(language || defaultLanguage);

  if (normalizedLanguage === "ar") {
    return buildArabicAccentOptions(voices);
  }

  const aliases = ACCENT_ALIASES_BY_LANGUAGE[normalizedLanguage] || [];
  if (!aliases.length) return [];

  const availability = getAccentAvailabilityMap(voices);
  const displays = [];

  for (const alias of aliases) {
    if (alias.token === "neutral") continue;
    const count = availability.get(`${normalizedLanguage}|${alias.display}`) || 0;
    if (count > 0) displays.push(alias.display);
  }

  return uniqueSortedDisplay(displays);
};

/**
 * Temporary production debug — logs when Arabic filter modal opens.
 */
export const logArabicAccentOptionsDebug = ({
  context = "",
  voices = [],
  computedAccentOptions = [],
  stateAccentOptionsByLanguage = {},
  catalogSource = "",
} = {}) => {
  if (typeof console === "undefined" || typeof console.info !== "function") return;

  const totalVoices = (voices || []).length;
  const arabicVoicesCount = countVoicesMatchingLanguageForAvailability(voices, "ar");
  const strictArabicCount = (voices || []).filter((v) => strictLanguageDecision(v, "ar").pass).length;
  const arabicSamples = (voices || [])
    .filter((v) => voiceMatchesLanguageForAvailability(v, "ar"))
    .slice(0, 8)
    .map(sampleVoiceLanguageAccentMetadata);

  const availability = getAccentAvailabilityMap(voices);
  const dialectCounts = Object.fromEntries(
    ARABIC_DIALECT_DISPLAYS.map((display) => [display, availability.get(`ar|${display}`) || 0])
  );

  console.info("[ARABIC ACCENT OPTIONS]", {
    buildTag: VOICE_FILTER_BUILD_TAG,
    context,
    catalogSource,
    totalVoices,
    arabicVoicesCount,
    strictArabicLanguagePassCount: strictArabicCount,
    computedArabicAccentOptions: computedAccentOptions,
    stateAccentOptionsAr: stateAccentOptionsByLanguage?.ar || [],
    dialectVoiceCounts: dialectCounts,
    sampleArabicVoiceMetadata: arabicSamples,
  });
};

/** True when only language + accent + gender are active (no tone/pitch/age/category/search). */
export const isCoreLanguageAccentGenderFilter = (applied = {}) => {
  const extras = ["search", "age", "category", "tone", "pitch"];
  return !extras.some((key) => String(applied?.[key] || "").trim());
};

export const getAccentMatchTierFromReason = (reason = "") => {
  const r = String(reason || "");
  if (!r) return null;
  if (r.endsWith("-locale-proof") || r === "english-exclusive" || r === "arabic-exclusive") {
    return "strict";
  }
  if (
    r.endsWith("-accent-phrase-fallback") ||
    r.endsWith("-generic-fallback") ||
    r.endsWith("-language-pool-fallback") ||
    r.endsWith("-general-language-pool-fallback")
  ) {
    return "fallback";
  }
  return "strict";
};

export const partitionVoicesByLanguageAccentTier = (
  voices,
  { language = "", accent = "", gender = "" } = {}
) => {
  const selectedLanguage = normalizeLanguageFilterValue(language);
  const selectedAccent = accent ? normalizeAccentToken(accent) : "";
  const selectedGender = normalizeGenderToken(gender);

  const strict = [];
  const fallback = [];

  for (const voice of voices || []) {
    const decision = strictVoiceMatchesLanguageAccent(voice, {
      language: selectedLanguage,
      accent: selectedAccent,
      gender: selectedGender,
    });
    if (!decision.pass) continue;
    const tier = getAccentMatchTierFromReason(decision.reason);
    if (tier === "fallback") fallback.push(voice);
    else strict.push(voice);
  }

  return {
    strict,
    fallback,
    pool: [...strict, ...fallback],
    strictCount: strict.length,
    fallbackCount: fallback.length,
    finalCount: strict.length + fallback.length,
  };
};

export const countVoicesForAccentOption = (voices, language, accentDisplay, { gender = "" } = {}) => {
  const lang = normalizeLanguageFilterValue(language);
  const accentToken = normalizeAccentToken(accentDisplay);
  if (!lang || !accentToken) return 0;
  return partitionVoicesByLanguageAccentTier(voices, {
    language: lang,
    accent: accentToken,
    gender: normalizeGenderToken(gender),
  }).finalCount;
};

export const logVoiceFilterAvailability = (context, applied, stats = {}) => {
  if (!shouldLogStrictVoiceFilter()) return;
  if (typeof console === "undefined" || typeof console.info !== "function") return;
  console.info("[VOICE FILTER AVAILABILITY]", {
    context,
    language: applied?.language || "",
    accent: applied?.accent || "",
    gender: applied?.gender || "",
    strictCount: stats.strictCount ?? 0,
    fallbackCount: stats.fallbackCount ?? 0,
    finalCount: stats.finalCount ?? 0,
  });
};
