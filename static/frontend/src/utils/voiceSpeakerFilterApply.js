import {
  DEFAULT_MODAL_VOICE_FILTERS,
  DEFAULT_VOICE_LANGUAGE,
  appliedFiltersToModalPatch,
  filtersModalToApplied,
} from "./voiceFilterModal";
import { normalizeGenderToken } from "./voiceGender";
import {
  firstVoiceIdFromStrictPool,
  getStrictFilteredVoicePool,
  getVoiceDisplayNameFromPoolItem,
  getVoiceIdFromPoolItem,
  logStrictDropdownFinal,
  pickVoiceIdFromStrictPool,
} from "./strictVoicePool";

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

/** Strict voice list for modal preview + dropdown (single source of truth). */
export const refineVoicesForSpeakerModalFilters = (voices, modalFilters, speaker = {}) =>
  getStrictFilteredVoicePool(voices, buildAppliedVoiceFiltersForSpeaker(modalFilters, speaker));

/** Seed modal draft state from applied filters (e.g. when opening the filters modal). */
export const modalFiltersFromApplied = (applied, speaker = {}) => {
  const patch = appliedFiltersToModalPatch(applied || emptyAppliedSpeakerVoiceFilters());
  const speakerGenderTok = normalizeGenderToken(speaker?.gender);
  if (!applied?.gender && speakerGenderTok) {
    patch.gender = speakerGenderTok || "__all__";
  }
  return { ...DEFAULT_MODAL_VOICE_FILTERS, ...patch };
};

export const getVoiceIdFromItem = getVoiceIdFromPoolItem;
export const getVoiceDisplayNameFromItem = getVoiceDisplayNameFromPoolItem;

/** Build applied filters from modal Done payload + speaker card gender. */
export const appliedFiltersFromModalDone = (sanitizedModal, speaker = {}) =>
  buildAppliedVoiceFiltersForSpeaker(
    filtersModalToApplied(sanitizedModal || DEFAULT_MODAL_VOICE_FILTERS),
    speaker
  );

export const pickVoiceIdFromFilteredPool = pickVoiceIdFromStrictPool;
export const firstVoiceIdFromPool = firstVoiceIdFromStrictPool;

/** @deprecated Use logStrictDropdownFinal */
export const logVoiceDropdownDebug = logStrictDropdownFinal;

export { getStrictFilteredVoicePool, logStrictDropdownFinal };
