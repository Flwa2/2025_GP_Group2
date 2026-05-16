const AGE_SPLIT = /[,;/|]/;

const splitAgeValues = (value) => {
  if (Array.isArray(value)) return value.flatMap(splitAgeValues);
  if (typeof value === "string") {
    return value
      .split(AGE_SPLIT)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (value == null) return [];
  const text = String(value).trim();
  return text ? [text] : [];
};

export const normalizeVoiceAgeValue = (value) => {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
  if (!raw) return "";
  if (["young", "youth", "youthful", "young_adult"].includes(raw)) return "young";
  if (["middle_aged", "middle_age", "middle"].includes(raw)) return "middle_aged";
  if (["old", "older", "senior", "elderly", "aged"].includes(raw)) return "old";
  return raw;
};

export const formatVoiceAgeLabel = (value) => {
  const normalized = normalizeVoiceAgeValue(value);
  if (normalized === "young") return "Young";
  if (normalized === "middle_aged") return "Middle-aged";
  if (normalized === "old") return "Old/Senior";
  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const voiceAgeTokens = (voice) => {
  const labels = voice?.labels && typeof voice.labels === "object" ? voice.labels : {};
  const values = [
    ...splitAgeValues(voice?.age),
    ...splitAgeValues(voice?.Age),
    ...splitAgeValues(voice?.age_group),
    ...splitAgeValues(voice?.AgeGroup),
    ...splitAgeValues(voice?.ageGroup),
    ...splitAgeValues(labels.age),
    ...splitAgeValues(labels.Age),
    ...splitAgeValues(labels.age_group),
    ...splitAgeValues(labels.AgeGroup),
    ...splitAgeValues(labels.ageGroup),
  ];
  return Array.from(new Set(values.map(normalizeVoiceAgeValue).filter(Boolean)));
};

export const voiceMatchesAge = (voice, selectedAge) => {
  const normalized = normalizeVoiceAgeValue(selectedAge);
  if (!normalized) return true;
  return voiceAgeTokens(voice).includes(normalized);
};

export const collectVoiceAgeOptions = (voices) => {
  const seen = new Set();
  for (const voice of voices || []) {
    for (const age of voiceAgeTokens(voice)) seen.add(age);
  }
  const preferredOrder = ["young", "middle_aged", "old"];
  return Array.from(seen).sort((a, b) => {
    const ai = preferredOrder.indexOf(a);
    const bi = preferredOrder.indexOf(b);
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    return formatVoiceAgeLabel(a).localeCompare(formatVoiceAgeLabel(b), undefined, { sensitivity: "base" });
  });
};
