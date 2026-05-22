import { normalizeLanguageFilterValue } from "../components/voiceFilterLanguage";
import { ARABIC_ACCENT_ALIASES, ENGLISH_ACCENT_ALIASES, normalizeAccentToken } from "./voiceAccentConstants";

const uniqueSortedDisplay = (displays) =>
  Array.from(new Set(displays.map((x) => String(x).trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
import { normalizeGenderToken } from "./voiceGender";
import { strictVoiceMatchesLanguageAccent } from "./strictVoiceFilter";

const ACCENT_ALIASES_BY_LANGUAGE = {
  ar: ARABIC_ACCENT_ALIASES,
  en: ENGLISH_ACCENT_ALIASES,
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

export const countVoicesForAccentOption = (
  voices,
  language,
  accentDisplay,
  { gender = "" } = {}
) => {
  const lang = normalizeLanguageFilterValue(language);
  const accentToken = normalizeAccentToken(accentDisplay);
  if (!lang || !accentToken) return 0;
  return partitionVoicesByLanguageAccentTier(voices, {
    language: lang,
    accent: accentToken,
    gender: normalizeGenderToken(gender),
  }).finalCount;
};

/**
 * Accent dropdown options derived from catalog — only accents with ≥1 matching voice.
 */
export const buildAvailableAccentOptionsForLanguage = (
  voices,
  language,
  defaultLanguage = "en",
  { gender = "" } = {}
) => {
  const normalizedLanguage = normalizeLanguageFilterValue(language || defaultLanguage);
  const aliases = ACCENT_ALIASES_BY_LANGUAGE[normalizedLanguage] || [];
  const displays = [];

  for (const alias of aliases) {
    if (alias.token === "neutral") continue;
    const count = countVoicesForAccentOption(voices, normalizedLanguage, alias.display, { gender });
    if (count > 0) displays.push(alias.display);
  }

  return uniqueSortedDisplay(displays);
};

export const logVoiceFilterAvailability = (context, applied, stats = {}) => {
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
