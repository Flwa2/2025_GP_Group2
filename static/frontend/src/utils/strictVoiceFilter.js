import { normalizeLanguageFilterValue } from "../components/voiceFilterLanguage";
import { languageForAccentValue, normalizeAccentToken } from "./voiceAccentFilters";
import { normalizeGenderToken } from "./voiceGender";
import { voiceMatchesAge } from "./voiceAgeFilters";
import { voiceMatchesPitch, voiceMatchesTone } from "./voiceTonePitchFilters";
import { normalizeCategoryLabelKey, voiceMatchesRoleCategory } from "./voiceRoleCategories";
import {
  collectStructuredLocales,
  detectStructuredVoiceAccents,
  detectStructuredVoiceLanguages,
  strictAccentDecision,
  strictLanguageDecision,
  voiceDebugLabel,
} from "./strictVoiceMetadata";

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

export const shouldLogStrictVoiceFilter = () => {
  try {
    if (typeof window !== "undefined" && window.localStorage?.getItem("wecastVoiceFilterDebug") === "1") {
      return true;
    }
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
};

const logStrictVoicePass = (row) => {
  if (!shouldLogStrictVoiceFilter() || typeof console === "undefined") return;
  console.debug(
    `[strictVoiceFilter] PASS voice="${row.voiceName}" locale=${JSON.stringify(row.locales)} normalizedLanguage=${JSON.stringify(row.normalizedLanguage)} normalizedAccent=${JSON.stringify(row.normalizedAccent)} selectedLanguage=${row.selectedLanguage || ""} selectedAccent=${row.selectedAccent || ""} reason=${row.reason}`
  );
};

/**
 * Strict language + accent (+ optional gender) match used by Create and Edit.
 */
export const strictVoiceMatchesLanguageAccent = (voice, { language = "", accent = "", gender = "" } = {}) => {
  const selectedLanguage = normalizeLanguageFilterValue(language) || languageForAccentValue(accent);
  const selectedAccent = accent ? normalizeAccentToken(accent) : "";
  const selectedGender = normalizeGenderToken(gender);

  const langDecision = strictLanguageDecision(voice, selectedLanguage);
  if (!langDecision.pass) {
    return {
      pass: false,
      reason: langDecision.reason,
      normalizedLanguage: langDecision.normalizedLanguages,
      normalizedAccent: detectStructuredVoiceAccents(voice, selectedLanguage),
      selectedLanguage,
      selectedAccent,
    };
  }

  if (selectedGender) {
    const voiceGender = normalizeGenderToken(
      voice?.gender || voice?.labels?.gender || voice?.labels?.Gender
    );
    if (voiceGender !== selectedGender) {
      return {
        pass: false,
        reason: "gender-mismatch",
        normalizedLanguage: langDecision.normalizedLanguages,
        normalizedAccent: detectStructuredVoiceAccents(voice, selectedLanguage),
        selectedLanguage,
        selectedAccent,
      };
    }
  }

  const accentDecision = strictAccentDecision(voice, selectedLanguage, selectedAccent);
  if (!accentDecision.pass) {
    return {
      pass: false,
      reason: accentDecision.reason,
      normalizedLanguage: langDecision.normalizedLanguages,
      normalizedAccent: accentDecision.normalizedAccents,
      locales: accentDecision.locales || collectStructuredLocales(voice),
      selectedLanguage,
      selectedAccent,
    };
  }

  return {
    pass: true,
    reason: selectedAccent ? accentDecision.reason : langDecision.reason,
    normalizedLanguage: langDecision.normalizedLanguages,
    normalizedAccent: accentDecision.normalizedAccents,
    locales: accentDecision.locales || collectStructuredLocales(voice),
    selectedLanguage,
    selectedAccent,
  };
};

/**
 * Filter voices by strict language/accent/gender. Search/category/age/tone/pitch are handled separately.
 */
export const strictFilterVoicesByLanguageAccent = (
  voices,
  { language = "", accent = "", gender = "" } = {},
  { logPasses = shouldLogStrictVoiceFilter() } = {}
) => {
  const selectedLanguage = normalizeLanguageFilterValue(language) || languageForAccentValue(accent);
  const selectedAccent = accent ? normalizeAccentToken(accent) : "";

  if (!selectedLanguage && !selectedAccent && !gender) {
    return voices || [];
  }

  const out = [];
  const rejectSamples = [];
  for (const voice of voices || []) {
    const decision = strictVoiceMatchesLanguageAccent(voice, {
      language: selectedLanguage,
      accent: selectedAccent,
      gender,
    });

    if (decision.pass) {
      if (logPasses) {
        logStrictVoicePass({
          voiceName: voiceDebugLabel(voice),
          locales: decision.locales,
          normalizedLanguage: decision.normalizedLanguage,
          normalizedAccent: decision.normalizedAccent,
          selectedLanguage,
          selectedAccent,
          reason: decision.reason,
        });
      }
      out.push(voice);
    } else if (rejectSamples.length < 30) {
      rejectSamples.push({
        voice: voiceDebugLabel(voice),
        reason: decision.reason,
        locales: decision.locales || [],
        languages: decision.normalizedLanguage || [],
      });
    }
  }

  if (
    !out.length &&
    (selectedLanguage || selectedAccent) &&
    shouldLogStrictVoiceFilter() &&
    typeof console !== "undefined" &&
    typeof console.info === "function"
  ) {
    const reasonCounts = rejectSamples.reduce((acc, row) => {
      const key = String(row.reason || "unknown");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    console.info("[STRICT VOICE FILTER EMPTY]", {
      selectedLanguage,
      selectedAccent,
      selectedGender: gender || "",
      candidateCount: (voices || []).length,
      reasonCounts,
      sampleRejections: rejectSamples.slice(0, 15),
    });
  }

  return out;
};

export { detectStructuredVoiceLanguages, detectStructuredVoiceAccents };
