import { normalizeLanguageFilterValue } from "../components/voiceFilterLanguage";
import {
  accentTokensForLanguageFromVoice,
  languageFilterMatches,
  languageMatchTokensForVoice,
} from "./voiceAccentFilters";
import { voiceMatchesAge } from "./voiceAgeFilters";
import { normalizeGenderToken } from "./voiceGender";
import { voiceMatchesPitch, voiceMatchesTone } from "./voiceTonePitchFilters";
import { normalizeCategoryLabelKey, voiceMatchesRoleCategory } from "./voiceRoleCategories";

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

export const clientRefineVoicesByTonePitch = (items, tone, pitch) => {
  if (!tone && !pitch) return items;
  return (items || []).filter((voice) => {
    if (!voiceMatchesPitch(voice, pitch)) return false;
    if (!voiceMatchesTone(voice, tone)) return false;
    return true;
  });
};

/** Client-side filter matching Create/Edit voice dropdown logic. */
export const clientRefineLibraryVoices = (items, applied) => {
  let out = clientRefineVoicesByTonePitch(items, applied?.tone, applied?.pitch);
  const q = String(applied?.search || "").trim().toLowerCase();
  const g = normalizeGenderToken(applied?.gender);
  const lang = normalizeLanguageFilterValue(applied?.language);
  const accent = String(applied?.accent || "").trim().toLowerCase();
  const age = String(applied?.age || "").trim();
  const category = normalizeCategoryLabelKey(applied?.category);

  if (q) {
    out = out.filter((voice) => voiceSearchHaystack(voice).includes(q));
  }
  if (g) {
    out = out.filter(
      (voice) => normalizeGenderToken(voice.gender || voice.labels?.gender || voice.labels?.Gender) === g
    );
  }
  if (lang) {
    out = out.filter((voice) => languageFilterMatches(lang, languageMatchTokensForVoice(voice)));
  }
  if (accent) {
    out = out.filter((voice) => accentTokensForLanguageFromVoice(voice, lang).includes(accent));
  }
  if (age) {
    out = out.filter((voice) => voiceMatchesAge(voice, age));
  }
  if (category) {
    out = out.filter((voice) => voiceMatchesRoleCategory(voice, category));
  }
  return out;
};
