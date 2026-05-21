import React from "react";
import { useTranslation } from "react-i18next";

/** Live filter match count — same UI on Create Podcast and Edit Podcast. */
export default function VoiceFilterPreviewCount({
  loading = false,
  refinedCount = null,
  accent = "",
}) {
  const { t } = useTranslation();

  let text = "";
  if (loading) {
    text = t("create.speakers.searchingVoices", { defaultValue: "Searching…" });
  } else if (refinedCount === 0 && String(accent || "").trim()) {
    text = t("create.speakers.noMatchingAccentVoices", {
      defaultValue: "No voices found for this accent. Try another accent or clear the accent filter.",
    });
  } else if (refinedCount != null) {
    text = t("create.speakers.filteredCount", {
      count: refinedCount,
      defaultValue: "{{count}} voices match current filters",
    });
  }

  if (!text) return null;

  return <p className="text-xs leading-snug text-black/60 dark:text-white/60">{text}</p>;
}
