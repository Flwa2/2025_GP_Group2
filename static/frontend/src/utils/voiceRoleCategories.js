export const normalizeCategoryLabelKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");

const VOICE_ROLE_CATEGORIES = [
  { value: "podcast_host", keywords: ["podcast", "podcaster", "host", "presenter", "broadcast"] },
  { value: "narrator", keywords: ["narrator", "narration", "narrative", "storytelling", "voiceover"] },
  { value: "teacher", keywords: ["teacher", "educator", "educational", "education", "explainer", "instructor"] },
  { value: "news_reader", keywords: ["news", "journalist", "anchor", "announcer", "reporter", "headline"] },
  { value: "interview_host", keywords: ["interview", "interviewer", "conversation", "conversational", "talk show"] },
  { value: "commercial_voice", keywords: ["commercial", "advertisement", "advertising", "promo", "promotional", "marketing"] },
  { value: "audiobook_voice", keywords: ["audiobook", "audio book", "book", "reading", "literary"] },
  { value: "documentary_voice", keywords: ["documentary", "docuseries", "documentarian"] },
];

const voiceCategoryHaystack = (voice) => {
  const labels = voice?.labels && typeof voice.labels === "object" ? voice.labels : {};
  return [
    voice?.category,
    voice?.use_case,
    voice?.useCase,
    voice?.description,
    voice?.name,
    labels.category,
    labels.Category,
    labels.use_case,
    labels.useCase,
    labels.usecase,
    labels.description,
    labels.Description,
  ]
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .map((part) => String(part || "").toLowerCase())
    .join(" ");
};

export const voiceMatchesRoleCategory = (voice, categoryValue) => {
  const category = VOICE_ROLE_CATEGORIES.find((item) => item.value === categoryValue);
  if (!category) return true;
  const haystack = voiceCategoryHaystack(voice);
  return category.keywords.some((keyword) => haystack.includes(keyword));
};

export const roleCategoryOptionsForVoices = (voices) =>
  VOICE_ROLE_CATEGORIES.filter((category) =>
    (voices || []).some((voice) => voiceMatchesRoleCategory(voice, category.value))
  ).map((category) => ({
    value: category.value,
    label: category.value
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  }));
