import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Modal from "./Modal";
import VoiceFilterSelect from "./VoiceFilterSelect";
import { LanguageLabel, normalizeLanguageFilterValue, uniqueLanguageOptions } from "./voiceFilterLanguage";
import {
  DEFAULT_VOICE_LANGUAGE,
  getSafeModalGenderFilter,
  sanitizeModalFiltersForDone,
} from "../utils/voiceFilterModal";
import { PITCH_VALUES, TONE_FILTER_VALUES, formatPitchLabel, formatToneLabel } from "../utils/voiceTonePitchFilters";
import { formatVoiceAgeLabel } from "../utils/voiceAgeFilters";
import { normalizeAccentToken } from "../utils/voiceAccentFilters";
import VoiceFilterPreviewCount from "./VoiceFilterPreviewCount";

/** Shared voice filter modal — identical UI on Create Podcast and Edit Podcast. */
export default function VoiceFiltersModal({
  open,
  onClose,
  filters,
  onFiltersChange,
  accentOptions = [],
  ageOptions = [],
  categoryOptions = [],
  isRTL = false,
  onClear,
  onDone,
  preview = null,
  previewSlot = null,
  catalogVoices = [],
  accentOptionsSource = "",
  normalizeCategoryLabelKey = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_")
      .replace(/_+/g, "_"),
  formatVoiceCategoryLabel = (value) => value,
}) {
  const { t } = useTranslation();
  const makeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const translateAge = (value) =>
  t(`create.speakers.ageOptions.${value}`, {
    defaultValue: formatVoiceAgeLabel(value),
  });

const translateTone = (value) =>
  t(`create.speakers.toneOptions.${value}`, {
    defaultValue: formatToneLabel(value),
  });

const translatePitch = (value) =>
  t(`create.speakers.pitchOptions.${value}`, {
    defaultValue: formatPitchLabel(value),
  });

const translateAccent = (value) =>
  t(`create.speakers.accentOptions.${makeKey(value)}`, {
    defaultValue: value,
  });

const translateCategory = (value) =>
  t(`create.speakers.categoryOptions.${makeKey(value)}`, {
    defaultValue: value,
  });

  const safeGenderFilter = getSafeModalGenderFilter(filters?.gender);
  const rawSelectedLanguage = filters?.language || DEFAULT_VOICE_LANGUAGE;
  const selectedLanguage = normalizeLanguageFilterValue(rawSelectedLanguage);
  const visibleAccentOptions = accentOptions;

  useEffect(() => {
    if (!open || selectedLanguage !== "ar") return;
    logArabicAccentOptionsDebug({
      context: `VoiceFiltersModal/${accentOptionsSource || "unknown"}`,
      voices: catalogVoices,
      computedAccentOptions: accentOptions,
      catalogSource: accentOptionsSource,
    });
  }, [open, selectedLanguage, accentOptions, catalogVoices, accentOptionsSource]);

  const languageOptions = uniqueLanguageOptions();
  const toneOptions = TONE_FILTER_VALUES;
  const pitchOptions = PITCH_VALUES;

  const selectedAccentValid =
    !filters?.accent ||
    visibleAccentOptions.some((accent) => normalizeAccentToken(accent) === normalizeAccentToken(filters.accent));
  const selectedAgeValid =
    !filters?.age || ageOptions.some((age) => String(age).toLowerCase() === String(filters.age).toLowerCase());
  const selectedPitchValid =
    !filters?.pitch ||
    pitchOptions.some((pitch) => String(pitch).toLowerCase() === String(filters.pitch).toLowerCase());
  const selectedCategoryValid =
    !filters?.category ||
    categoryOptions.some((category) => category.value === normalizeCategoryLabelKey(filters.category));
  const selectedToneValid =
    !filters?.tone || toneOptions.some((tone) => String(tone).toLowerCase() === String(filters.tone).toLowerCase());

const genderOptions = useMemo(
  () =>
    ["female", "male"].map((gender) => ({
      value: gender,
      label: t(`create.speakers.genderOptions.${gender}`, {
        defaultValue: gender === "female" ? "Female" : "Male",
      }),
    })),
  [t]
);

  const setFilters = (patch) => onFiltersChange?.({ ...filters, ...patch });

  const setLanguageFilter = (language) => {
    const nextLanguage = normalizeLanguageFilterValue(language || DEFAULT_VOICE_LANGUAGE);
    setFilters({
      language: nextLanguage,
      accent: "",
      languageMenuOpen: false,
    });
  };

  const activeFilterChips = [
    String(filters?.q || "").trim()
      ? { key: "q", label: `${t("create.speakers.search", "Search")}: ${String(filters.q).trim()}` }
      : null,
safeGenderFilter !== "__all__"
  ? {
      key: "gender",
      label: `${t("create.speakers.gender", "Gender")}: ${t(
        `create.speakers.genderOptions.${safeGenderFilter}`,
        { defaultValue: safeGenderFilter }
      )}`,
    }
  : null,
    filters?.language
      ? {
          key: "language",
          label: (
            <>
              {t("create.speakers.language", "Language")}: <LanguageLabel value={filters.language} />
            </>
          ),
        }
      : null,
filters?.category
  ? {
      key: "category",
      label: `${t("create.speakers.category", "Category")}: ${translateCategory(filters.category)}`,
    }
  : null,
filters?.tone
  ? {
      key: "tone",
      label: `${t("create.speakers.tone", "Tone")}: ${translateTone(filters.tone)}`,
    }
  : null,
filters?.pitch
  ? {
      key: "pitch",
      label: `${t("create.speakers.pitch", "Pitch")}: ${translatePitch(filters.pitch)}`,
    }
  : null,
filters?.accent
  ? {
      key: "accent",
      label: `${t("create.speakers.accent", "Accent")}: ${translateAccent(filters.accent)}`,
    }
  : null,
filters?.age
  ? {
      key: "age",
      label: `${t("create.speakers.age", "Age")}: ${translateAge(filters.age)}`,
    }
  : null,
  ].filter(Boolean);

  const handleDone = () => {
    const sanitized = sanitizeModalFiltersForDone(filters, {
      accentOptions: visibleAccentOptions,
      toneOptions,
      pitchOptions,
      ageOptions,
      categoryOptions,
      normalizeCategoryLabelKey,
    });
    onFiltersChange?.(sanitized);
    onDone?.(sanitized);
  };

  return (
    <Modal
      open={open}
      title={t("create.speakers.filters", "Filters")}
      onClose={onClose}
      isRTL={isRTL}
      dense
      footer={
        <>
          <button
            type="button"
            onClick={onClear}
            className="px-4 h-10 min-h-10 rounded-xl border border-neutral-300 bg-white text-neutral-800 text-sm font-semibold transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          >
            {t("create.speakers.clearFilters", "Clear Filters")}
          </button>
          <button
            type="button"
            onClick={handleDone}
            className="px-4 h-10 min-h-10 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:opacity-95 transition"
          >
            {t("create.common.done", "Done")}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-2.5">
        <div>
          <label className="form-label mb-1 block">{t("create.speakers.search", "Search")}</label>
          <input
            value={filters?.q || ""}
            onChange={(e) => setFilters({ q: e.target.value })}
            placeholder={t("create.speakers.searchPlaceholder", "Search by voice name...")}
            className="form-input !px-3 !py-2 min-h-10 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-x-3 md:gap-y-2.5">
          <div>
            <label className="form-label mb-1 block">{t("create.speakers.gender", "Gender")}</label>
            <VoiceFilterSelect
              value={safeGenderFilter}
              onChange={(value) => setFilters({ gender: value })}
              options={[
                { value: "__all__", label: t("create.speakers.allGenders", "All Genders") },
                ...genderOptions,
              ]}
              isRTL={isRTL}
              menuVariant="tone"
            />
          </div>

          <div>
            <label className="form-label mb-1 block">{t("create.speakers.age", "Age")}</label>
            <VoiceFilterSelect
              value={selectedAgeValid ? filters?.age || "" : ""}
              onChange={(value) => setFilters({ age: value })}
              options={[
                { value: "", label: t("create.speakers.allAges", "All ages") },
                ...ageOptions.map((age) => ({ value: age, label: translateAge(age) })),
              ]}
              isRTL={isRTL}
              menuVariant="tone"
            />
          </div>

          <div>
            <label className="form-label mb-1 block">{t("create.speakers.language", "Language")}</label>
            <VoiceFilterSelect
              value={filters?.language || DEFAULT_VOICE_LANGUAGE}
              onChange={setLanguageFilter}
              options={languageOptions.map((lang) => ({
                value: lang,
                label: <LanguageLabel value={lang} />,
              }))}
              isRTL={isRTL}
              menuVariant="tone"
            />
          </div>

          <div>
            <label className="form-label mb-1 block">{t("create.speakers.accent", "Accent")}</label>
            <VoiceFilterSelect
              value={selectedAccentValid ? filters?.accent || "" : ""}
              onChange={(value) => setFilters({ accent: value })}
              options={[
                { value: "", label: t("create.speakers.allAccents", "All accents") },
                ...visibleAccentOptions.map((accent) => ({
                  value: accent,
                  label: translateAccent(accent),
                })),
              ]}
              isRTL={isRTL}
              menuVariant="tone"
              menuSize="compact"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-x-3 md:gap-y-2.5">
          <div>
            <label className="form-label mb-1 block">{t("create.speakers.tone", "Tone")}</label>
            <VoiceFilterSelect
              value={selectedToneValid ? filters?.tone || "" : ""}
              onChange={(value) => setFilters({ tone: value })}
              options={[
                { value: "", label: t("create.speakers.allTones", "All Tones") },
                ...toneOptions.map((tone) => ({ value: tone, label: translateTone(tone) })),
              ]}
              isRTL={isRTL}
              menuVariant="tone"
              menuSize="compact"
            />
          </div>

          <div>
            <label className="form-label mb-1 block">{t("create.speakers.pitch", "Pitch")}</label>
            <VoiceFilterSelect
              value={selectedPitchValid ? filters?.pitch || "" : ""}
              onChange={(value) => setFilters({ pitch: value })}
              options={[
                { value: "", label: t("create.speakers.allPitches", "All Pitches") },
                ...pitchOptions.map((pitch) => ({ value: pitch, label: translatePitch(pitch) })),
              ]}
              isRTL={isRTL}
              menuVariant="tone"
            />
          </div>
        </div>

        {categoryOptions.length > 0 ? (
          <div>
            <label className="form-label mb-1 block">{t("create.speakers.category", "Category")}</label>
            <VoiceFilterSelect
              value={selectedCategoryValid ? filters?.category || "" : ""}
              onChange={(value) => setFilters({ category: value })}
              options={[
                { value: "", label: t("create.speakers.allCategories", "All categories") },
                ...categoryOptions.map((category) => ({
                  value: category.value,
                  label: translateCategory(category.value),
                })),
              ]}
              isRTL={isRTL}
              menuVariant="tone"
              menuSize="compact"
            />
          </div>
        ) : null}

        {activeFilterChips.length > 0 ? (
          <div>
            <p className="mb-1 text-xs font-semibold text-black/60 dark:text-white/60">
              {t("create.speakers.activeFilters", "Active filters")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() =>
                    chip.key === "language"
                      ? setLanguageFilter(DEFAULT_VOICE_LANGUAGE)
                      : setFilters({
                          [chip.key]: chip.key === "gender" ? "__all__" : "",
                        })
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-purple-300/70 dark:border-purple-400/45 bg-purple-50 dark:bg-purple-900/25 px-2 py-0.5 text-xs text-purple-700 dark:text-purple-200"
                  title={t("create.speakers.removeFilter", "Remove filter")}
                >
                  <span>{chip.label}</span>
                  <span>x</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {previewSlot ?? (
          preview ? (
            <VoiceFilterPreviewCount
              loading={preview.loading}
              refinedCount={preview.refinedCount}
              accent={filters?.accent}
            />
          ) : null
        )}
      </div>
    </Modal>
  );
}
