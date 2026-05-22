import { normalizeLanguageFilterValue } from "../components/voiceFilterLanguage";
import { ARABIC_ACCENT_ALIASES, ENGLISH_ACCENT_ALIASES, normalizeAccentToken } from "./voiceAccentConstants";
import { normalizeGenderToken } from "./voiceGender";
import { strictAccentDecision, strictLanguageDecision } from "./strictVoiceMetadata";
import { strictVoiceMatchesLanguageAccent, shouldLogStrictVoiceFilter } from "./strictVoiceFilter";

const uniqueSortedDisplay = (displays) =>
  Array.from(new Set(displays.map((x) => String(x).trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

const ACCENT_ALIASES_BY_LANGUAGE = {
  ar: ARABIC_ACCENT_ALIASES,
  en: ENGLISH_ACCENT_ALIASES,
};

let accentAvailabilityCache = { catalogKey: "", map: null };

const catalogCacheKey = (voices) => {
  const list = voices || [];
  if (!list.length) return "0";
  const first = list[0]?.providerVoiceId || list[0]?.id || "";
  const last = list[list.length - 1]?.providerVoiceId || list[list.length - 1]?.id || "";
  return `${list.length}:${first}:${last}`;
};

/** Invalidate when voice catalog is replaced (e.g. after fetch). */
export const invalidateAccentAvailabilityCache = () => {
  accentAvailabilityCache = { catalogKey: "", map: null };
};

/**
 * One pass per catalog: count voices per language+accent (gender excluded — accent list is not gender-scoped).
 */
export const getAccentAvailabilityMap = (voices) => {
  const key = catalogCacheKey(voices);
  if (accentAvailabilityCache.catalogKey === key && accentAvailabilityCache.map) {
    return accentAvailabilityCache.map;
  }

  const map = new Map();

  for (const voice of voices || []) {
    for (const lang of Object.keys(ACCENT_ALIASES_BY_LANGUAGE)) {
      const langDecision = strictLanguageDecision(voice, lang);
      if (!langDecision.pass) continue;

      for (const alias of ACCENT_ALIASES_BY_LANGUAGE[lang]) {
        if (alias.token === "neutral") continue;
        const accentDecision = strictAccentDecision(voice, lang, alias.token);
        if (!accentDecision.pass) continue;
        const mapKey = `${lang}|${alias.display}`;
        map.set(mapKey, (map.get(mapKey) || 0) + 1);
      }
    }
  }

  accentAvailabilityCache = { catalogKey: key, map };
  return map;
};

export const buildAvailableAccentOptionsForLanguage = (
  voices,
  language,
  defaultLanguage = "en"
) => {
  const normalizedLanguage = normalizeLanguageFilterValue(language || defaultLanguage);
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
    r.endsWith("-language-pool-fallback")
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
