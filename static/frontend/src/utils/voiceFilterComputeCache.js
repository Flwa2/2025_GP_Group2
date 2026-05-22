/**
 * Memoized strict pools + modal option derivations (Create / Edit filter modal).
 * Invalidate when catalog or filter inputs change (see invalidateVoiceFilterComputeCache).
 */
import { catalogCacheKey } from "./voiceCatalogCacheKey";
import { VOICE_AGE_BUCKETS, collectVoiceAgeOptions } from "./voiceAgeFilters";
import { roleCategoryOptionsForVoices } from "./voiceRoleCategories";
import { buildAvailableAccentOptionsForLanguage } from "./voiceFilterAvailability";
import { getStrictFilteredVoicePool } from "./strictVoicePool";

const APPLIED_KEYS = ["search", "gender", "language", "accent", "age", "category", "tone", "pitch"];
const MAX_CACHE_ENTRIES = 96;

const strictPoolCache = new Map();
const accentOptionsCache = new Map();
const modalDerivedCache = new Map();

export const appliedFiltersCacheKey = (applied = {}) =>
  APPLIED_KEYS.map((k) => `${k}=${String(applied?.[k] ?? "").trim().toLowerCase()}`).join("&");

const touch = (map, key, value) => {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  if (map.size > MAX_CACHE_ENTRIES) {
    const first = map.keys().next().value;
    map.delete(first);
  }
  return value;
};

export const invalidateVoiceFilterComputeCache = () => {
  strictPoolCache.clear();
  accentOptionsCache.clear();
  modalDerivedCache.clear();
};

/** Cached strict filtered pool (language/accent/gender + modal extras). */
export const getCachedStrictFilteredVoicePool = (voices, applied = {}) => {
  const key = `${catalogCacheKey(voices)}|${appliedFiltersCacheKey(applied)}`;
  if (strictPoolCache.has(key)) return strictPoolCache.get(key);
  const pool = getStrictFilteredVoicePool(voices, applied);
  return touch(strictPoolCache, key, pool);
};

/** Cached accent dropdown options for a language (catalog-wide; gender excluded). */
export const getCachedAccentOptionsForLanguage = (voices, language, defaultLanguage = "en") => {
  const lang = String(language || defaultLanguage).trim().toLowerCase();
  const key = `${catalogCacheKey(voices)}|accent:${lang}`;
  if (accentOptionsCache.has(key)) return accentOptionsCache.get(key);
  const options = buildAvailableAccentOptionsForLanguage(voices, language, defaultLanguage);
  return touch(accentOptionsCache, key, options);
};

/** Age + category options derived from a language-level strict pool (modal only). */
export const getCachedModalDerivedOptions = (languagePool, derivedKey) => {
  if (modalDerivedCache.has(derivedKey)) return modalDerivedCache.get(derivedKey);
  const ageOptions = collectVoiceAgeOptions([
    ...VOICE_AGE_BUCKETS.map((age) => ({ age })),
    ...(languagePool || []),
  ]);
  const categoryOptions = roleCategoryOptionsForVoices(languagePool || []);
  return touch(modalDerivedCache, derivedKey, { ageOptions, categoryOptions });
};
