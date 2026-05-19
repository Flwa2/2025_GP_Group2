const TOKEN_SPLIT = /[,;/|]/;

const splitValues = (value) => {
  if (Array.isArray(value)) return value.flatMap(splitValues);
  if (typeof value === "string") {
    return value
      .split(TOKEN_SPLIT)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (value == null) return [];
  const text = String(value).trim();
  return text ? [text] : [];
};

export const PITCH_VALUES = ["low", "medium", "high"];

const TONE_RULES = [
  { tone: "professional", keys: ["professional", "broadcaster", "corporate", "formal", "authoritative"] },
  { tone: "funny", keys: ["funny", "humorous", "comedic", "comic", "quirky", "playful"] },
  { tone: "friendly", keys: ["friendly", "warm", "comforting", "cozy", "welcoming", "pleasant"] },
  { tone: "calm", keys: ["calm", "relaxed", "soothing", "gentle", "smooth", "serene"] },
  { tone: "energetic", keys: ["energetic", "dynamic", "lively", "upbeat", "excited", "vibrant"] },
  { tone: "casual", keys: ["casual", "conversational", "natural", "chatty"] },
  { tone: "narrative", keys: ["narrative", "storytelling", "narration", "narrator"] },
  { tone: "dramatic", keys: ["dramatic", "cinematic", "intense", "theatrical"] },
  { tone: "serious", keys: ["serious", "deep", "resonant", "mature", "confident", "assertive"] },
  { tone: "educational", keys: ["educational", "educator", "teacher", "instructive", "explainer", "informative"] },
];

const TONE_SORT_ORDER = [
  "funny",
  "calm",
  "friendly",
  "energetic",
  "narrative",
  "dramatic",
  "casual",
  "professional",
  "serious",
  "educational",
];

export const TONE_FILTER_VALUES = TONE_SORT_ORDER;

const PITCH_ALIASES = {
  low: "low",
  deep: "low",
  resonant: "low",
  bass: "low",
  baritone: "low",
  grave: "low",
  high: "high",
  bright: "high",
  light: "high",
  youthful: "high",
  soprano: "high",
  medium: "medium",
  mid: "medium",
  balanced: "medium",
  neutral: "medium",
  natural: "medium",
};

const normalizeToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");

export const normalizePitchValue = (value) => {
  const token = normalizeToken(value);
  return PITCH_ALIASES[token] || token;
};

export const formatPitchLabel = (value) => {
  const pitch = normalizePitchValue(value);
  return pitch.charAt(0).toUpperCase() + pitch.slice(1);
};

export const normalizeToneValue = (value) => {
  const token = normalizeToken(value);
  if (!token) return "";
  for (const rule of TONE_RULES) {
    if (rule.keys.some((key) => token.includes(normalizeToken(key)))) return rule.tone;
  }
  return token;
};

export const formatToneLabel = (value) => {
  const tone = normalizeToneValue(value);
  return tone
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const voiceToneTokens = (voice) => {
  const labels = voice?.labels && typeof voice.labels === "object" ? voice.labels : {};
  const explicit = [
    ...splitValues(voice?.tone),
    ...splitValues(voice?.descriptive),
    ...splitValues(labels.tone),
    ...splitValues(labels.Tone),
    ...splitValues(labels.descriptive),
    ...splitValues(labels.Descriptive),
  ].map(normalizeToneValue).filter(Boolean);

  const haystack = [
    voice?.name,
    voice?.description,
    labels.description,
    labels.descriptive,
    voice?.category,
    labels.use_case,
    labels.usecase,
  ].map((part) => String(part || "").toLowerCase()).join(" ");

  const inferred = TONE_RULES
    .filter((rule) => rule.keys.some((key) => haystack.includes(key)))
    .map((rule) => rule.tone);

  return Array.from(new Set([...explicit, ...inferred]));
};

export const voicePitchToken = (voice) => {
  const labels = voice?.labels && typeof voice.labels === "object" ? voice.labels : {};
  const explicit = [
    ...splitValues(voice?.pitch),
    ...splitValues(voice?.Pitch),
    ...splitValues(voice?.pitch_range),
    ...splitValues(voice?.pitchRange),
    ...splitValues(labels.pitch),
    ...splitValues(labels.Pitch),
    ...splitValues(labels.pitch_range),
    ...splitValues(labels.pitchRange),
  ].map(normalizePitchValue).find((pitch) => PITCH_VALUES.includes(pitch));
  if (explicit) return explicit;

  const haystack = [
    voice?.name,
    voice?.description,
    labels.description,
    labels.descriptive,
  ].map((part) => String(part || "").toLowerCase()).join(" ");

  for (const [keyword, pitch] of Object.entries(PITCH_ALIASES)) {
    if (haystack.includes(keyword)) return pitch;
  }
  return "";
};

export const voiceMatchesTone = (voice, selectedTone) => {
  const tone = normalizeToneValue(selectedTone);
  if (!tone) return true;
  return voiceToneTokens(voice).includes(tone);
};

export const voiceMatchesPitch = (voice, selectedPitch) => {
  const pitch = normalizePitchValue(selectedPitch);
  if (!pitch) return true;
  return voicePitchToken(voice) === pitch;
};

export const collectVoiceToneOptions = (voices) => {
  const seen = new Set();
  for (const voice of voices || []) {
    for (const tone of voiceToneTokens(voice)) seen.add(tone);
  }
  return Array.from(seen).sort((a, b) => {
    const aIndex = TONE_SORT_ORDER.indexOf(a);
    const bIndex = TONE_SORT_ORDER.indexOf(b);
    if (aIndex !== -1 || bIndex !== -1) {
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    }
    return formatToneLabel(a).localeCompare(formatToneLabel(b), undefined, { sensitivity: "base" });
  });
};

export const buildTonePitchDebugMatrix = (voices, tones = [], pitches = PITCH_VALUES) => {
  const toneValues = tones.length ? tones.map(normalizeToneValue).filter(Boolean) : collectVoiceToneOptions(voices);
  const pitchValues = pitches.map(normalizePitchValue).filter((pitch) => PITCH_VALUES.includes(pitch));
  const totalByTone = Object.fromEntries(toneValues.map((tone) => [tone, voices.filter((voice) => voiceMatchesTone(voice, tone)).length]));
  const totalByPitch = Object.fromEntries(pitchValues.map((pitch) => [pitch, voices.filter((voice) => voiceMatchesPitch(voice, pitch)).length]));
  const combinations = {};
  for (const tone of toneValues) {
    combinations[tone] = {};
    for (const pitch of pitchValues) {
      combinations[tone][pitch] = voices.filter((voice) => voiceMatchesTone(voice, tone) && voiceMatchesPitch(voice, pitch)).length;
    }
  }
  return {
    totalVoices: voices.length,
    totalFunnyVoices: totalByTone.funny || 0,
    totalMediumPitchVoices: totalByPitch.medium || 0,
    totalFunnyMediumMatches: combinations.funny?.medium || 0,
    totalByTone,
    totalByPitch,
    combinations,
  };
};
