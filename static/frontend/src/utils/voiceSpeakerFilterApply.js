import { DEFAULT_VOICE_LANGUAGE } from "../components/voiceFilterLanguage";
import {
  DEFAULT_MODAL_VOICE_FILTERS,
  appliedFiltersToModalPatch,
  filtersModalToApplied,
} from "./voiceFilterModal";
import { normalizeGenderToken } from "./voiceGender";
import { clientRefineLibraryVoices } from "./voiceLibraryRefine";

export const emptyAppliedSpeakerVoiceFilters = () => ({
  search: "",
  gender: "",
  language: DEFAULT_VOICE_LANGUAGE,
  accent: "",
  age: "",
  category: "",
  tone: "",
  pitch: "",
});

/** Default applied filters for a speaker (gender only), matching Create Podcast. */
export const appliedVoiceFiltersForSpeakerGender = (speaker) => ({
  ...emptyAppliedSpeakerVoiceFilters(),
  gender: normalizeGenderToken(speaker?.gender),
});

const isNeutralGenderValue = (value) => {
  const g = String(value || "").trim().toLowerCase();
  return g.includes("neutral") || g.includes("netural");
};

/**
 * Convert modal filter state to applied filters (language, accent, gender, etc.).
 * Same rules as Create Podcast voice library filtering.
 */
export const buildAppliedVoiceFiltersForSpeaker = (modalFilters, speaker = {}) => {
  const f = modalFilters || DEFAULT_MODAL_VOICE_FILTERS;
  const speakerGenderRaw = String(speaker?.gender || "").trim().toLowerCase();
  const speakerGender = isNeutralGenderValue(speakerGenderRaw) ? "" : speakerGenderRaw;
  const selectedGender = String(f.gender || "").trim().toLowerCase();
  const effectiveGender =
    selectedGender === "__all__" || isNeutralGenderValue(selectedGender)
      ? ""
      : String(selectedGender || speakerGender || "").trim().toLowerCase();

  return filtersModalToApplied({
    ...f,
    gender: effectiveGender || (f.gender === "__all__" ? "" : f.gender),
  });
};

/** Client-side voice list for a speaker using Create-aligned filter rules. */
export const refineVoicesForSpeakerModalFilters = (voices, modalFilters, speaker = {}) =>
  clientRefineLibraryVoices(voices, buildAppliedVoiceFiltersForSpeaker(modalFilters, speaker));

/** Seed modal draft state from applied filters (e.g. when opening the filters modal). */
export const modalFiltersFromApplied = (applied, speaker = {}) => {
  const patch = appliedFiltersToModalPatch(applied || emptyAppliedSpeakerVoiceFilters());
  const speakerGenderTok = normalizeGenderToken(speaker?.gender);
  if (!applied?.gender && speakerGenderTok) {
    patch.gender = speakerGenderTok || "__all__";
  }
  return { ...DEFAULT_MODAL_VOICE_FILTERS, ...patch };
};
