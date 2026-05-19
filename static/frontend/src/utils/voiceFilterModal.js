export const DEFAULT_VOICE_LANGUAGE = "en";

export const DEFAULT_MODAL_VOICE_FILTERS = {
  q: "",
  gender: "__all__",
  language: DEFAULT_VOICE_LANGUAGE,
  category: "",
  tone: "",
  pitch: "",
  accent: "",
  age: "",
};

export const isNeutralGenderValue = (value) => {
  const g = String(value || "").trim().toLowerCase();
  return g.includes("neutral") || g.includes("netural");
};

export const getSafeModalGenderFilter = (gender) => {
  const g = String(gender || "").trim().toLowerCase();
  if (!g || g === "__all__" || isNeutralGenderValue(g)) return "__all__";
  return g;
};

export const filtersModalToApplied = (f) => ({
  search: String(f?.q || "").trim(),
  gender: f?.gender === "__all__" ? "" : String(f?.gender || "").trim().toLowerCase(),
  language: String(f?.language || "").trim(),
  accent: String(f?.accent || "").trim(),
  age: String(f?.age || "").trim(),
  category: String(f?.category || "").trim(),
  tone: String(f?.tone || "").trim(),
  pitch: String(f?.pitch || "").trim(),
});

export const appliedFiltersToModalPatch = (applied) => ({
  q: applied?.search || "",
  gender: applied?.gender || "__all__",
  language: applied?.language || "",
  category: applied?.category || "",
  tone: applied?.tone || "",
  pitch: applied?.pitch || "",
  accent: applied?.accent || "",
  age: applied?.age || "",
});

export const hasActiveModalVoiceFilters = (filters, safeGenderFilter) => {
  const f = filters || {};
  const genderActive = safeGenderFilter !== "__all__";
  return (
    !!String(f.q || "").trim() ||
    genderActive ||
    !!f.language ||
    !!f.category ||
    !!f.tone ||
    !!f.pitch ||
    !!f.accent ||
    !!f.age
  );
};

/** Matches Create Podcast Done behavior: only re-validate accent and tone. */
export const sanitizeModalFiltersForDone = (filters, validators = {}) => {
  const { accentOptions = [], toneOptions = [] } = validators;

  const selectedAccentValid =
    !filters.accent ||
    accentOptions.some((accent) => String(accent).trim().toLowerCase() === String(filters.accent).trim().toLowerCase());
  const selectedToneValid =
    !filters.tone ||
    toneOptions.some((tone) => String(tone).toLowerCase() === String(filters.tone).toLowerCase());

  return {
    ...filters,
    accent: selectedAccentValid ? filters.accent : "",
    tone: selectedToneValid ? filters.tone : "",
  };
};
