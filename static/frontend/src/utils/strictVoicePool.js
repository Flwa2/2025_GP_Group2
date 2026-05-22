/**
 * Single source of truth for strict voice filtering (Create + Edit).
 * Language/accent/gender matching lives in strictVoiceMetadata + strictVoiceFilter.
 */
import { normalizeLanguageFilterValue } from "../components/voiceFilterLanguage";
import { languageForAccentValue } from "./voiceAccentFilters";
import { normalizeGenderToken } from "./voiceGender";
import { voiceMatchesAge } from "./voiceAgeFilters";
import { voiceMatchesPitch, voiceMatchesTone } from "./voiceTonePitchFilters";
import { normalizeCategoryLabelKey, voiceMatchesRoleCategory } from "./voiceRoleCategories";
import { strictFilterVoicesByLanguageAccent, shouldLogStrictVoiceFilter } from "./strictVoiceFilter";

const voiceSearchHaystack = (voice) => {
  const parts = [voice?.name, voice?.description, voice?.category];
  if (voice?.labels && typeof voice.labels === "object") {
    for (const val of Object.values(voice.labels)) {
      if (typeof val === "string") parts.push(val);
      else if (Array.isArray(val)) val.forEach((x) => parts.push(String(x)));
    }
  }
  return parts
    .map((s) => String(s || "").toLowerCase())
    .join(" ");
};

export const getVoiceIdFromPoolItem = (voice) =>
  voice?.providerVoiceId || voice?.id || voice?.docId || "";

export const getVoiceDisplayNameFromPoolItem = (voice) =>
  voice?.name || voice?.displayName || voice?.providerVoiceId || voice?.id || "Unnamed voice";

/**
 * Strict filtered voice pool for dropdown, modal preview, and load-more pagination.
 */
export const getStrictFilteredVoicePool = (voices, applied = {}) => {
  let out = voices || [];
  const tone = String(applied?.tone || "").trim();
  const pitch = String(applied?.pitch || "").trim();
  if (tone || pitch) {
    out = out.filter((voice) => {
      if (pitch && !voiceMatchesPitch(voice, pitch)) return false;
      if (tone && !voiceMatchesTone(voice, tone)) return false;
      return true;
    });
  }

  const q = String(applied?.search || "").trim().toLowerCase();
  const gender = normalizeGenderToken(applied?.gender);
  const accent = String(applied?.accent || "").trim();
  const lang =
    normalizeLanguageFilterValue(applied?.language) || languageForAccentValue(accent);
  const age = String(applied?.age || "").trim();
  const category = normalizeCategoryLabelKey(applied?.category);

  if (q) {
    out = out.filter((voice) => voiceSearchHaystack(voice).includes(q));
  }

  if (lang || accent || gender) {
    out = strictFilterVoicesByLanguageAccent(out, { language: lang, accent, gender });
  }

  if (age) {
    out = out.filter((voice) => voiceMatchesAge(voice, age));
  }
  if (category) {
    out = out.filter((voice) => voiceMatchesRoleCategory(voice, category));
  }

  return out;
};

/** @deprecated Use getStrictFilteredVoicePool */
export const clientRefineLibraryVoices = (items, applied) =>
  getStrictFilteredVoicePool(items, applied);

export const pickVoiceIdFromStrictPool = (currentVoiceId, pool) => {
  const current = String(currentVoiceId || "").trim();
  if (!current) return "";
  const ids = new Set((pool || []).map(getVoiceIdFromPoolItem).filter(Boolean));
  return ids.has(current) ? current : "";
};

export const firstVoiceIdFromStrictPool = (pool) => {
  const first = (pool || []).find((voice) => getVoiceIdFromPoolItem(voice));
  return first ? getVoiceIdFromPoolItem(first) : "";
};

/** Debug log after filter modal Done (dev / wecastVoiceFilterDebug=1 only). */
export const logStrictDropdownFinal = (context, applied, pool) => {
  if (!shouldLogStrictVoiceFilter()) return;
  if (typeof console === "undefined" || typeof console.info !== "function") return;
  const names = (pool || [])
    .map(getVoiceDisplayNameFromPoolItem)
    .filter(Boolean)
    .slice(0, 20);
  const lang = applied?.language || "";
  const accent = applied?.accent || "";
  const gender = applied?.gender || "";
  const count = (pool || []).length;
  console.info(
    `[STRICT DROPDOWN FINAL] ${context}\n` +
      `selectedLanguage=${lang}\n` +
      `selectedAccent=${accent}\n` +
      `selectedGender=${gender}\n` +
      `finalCount=${count}\n` +
      `firstTwentyVoiceNames=${JSON.stringify(names)}`
  );
};
