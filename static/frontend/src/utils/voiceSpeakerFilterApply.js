import {
  DEFAULT_MODAL_VOICE_FILTERS,
  DEFAULT_VOICE_LANGUAGE,
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

export const getVoiceIdFromItem = (voice) =>
  voice?.providerVoiceId || voice?.id || voice?.docId || "";

export const getVoiceDisplayNameFromItem = (voice) =>
  voice?.name || voice?.displayName || voice?.providerVoiceId || voice?.id || "Unnamed voice";

/** Build applied filters from modal Done payload + speaker card gender. */
export const appliedFiltersFromModalDone = (sanitizedModal, speaker = {}) =>
  buildAppliedVoiceFiltersForSpeaker(
    filtersModalToApplied(sanitizedModal || DEFAULT_MODAL_VOICE_FILTERS),
    speaker
  );

export const pickVoiceIdFromFilteredPool = (currentVoiceId, pool) => {
  const current = String(currentVoiceId || "").trim();
  if (!current) return "";
  const ids = new Set((pool || []).map(getVoiceIdFromItem).filter(Boolean));
  return ids.has(current) ? current : "";
};

export const firstVoiceIdFromPool = (pool) => {
  const first = (pool || []).find((voice) => getVoiceIdFromItem(voice));
  return first ? getVoiceIdFromItem(first) : "";
};

/** Visible console log after filter Done (always on, per product debug request). */
export const logVoiceDropdownDebug = (context, applied, pool) => {
  if (typeof console === "undefined" || typeof console.info !== "function") return;
  const names = (pool || [])
    .map(getVoiceDisplayNameFromItem)
    .filter(Boolean)
    .slice(0, 10);
  console.info("[WeCast voice dropdown]", {
    context,
    selectedLanguage: applied?.language || "",
    selectedAccent: applied?.accent || "",
    selectedGender: applied?.gender || "",
    dropdownOptionCount: (pool || []).length,
    firstTenDropdownVoiceNames: names,
  });
};
