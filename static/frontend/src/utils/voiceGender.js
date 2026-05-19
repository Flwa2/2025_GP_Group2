export const isNeutralGenderValue = (value) => {
  const g = String(value || "").trim().toLowerCase();
  return g.includes("neutral") || g.includes("netural");
};

/** Normalize gender for filter matching (ElevenLabs uses male/female). */
export const normalizeGenderToken = (value) => {
  const s = String(value || "").trim().toLowerCase();
  if (!s || s === "__all__" || isNeutralGenderValue(s)) return "";
  if (s === "m" || s === "male" || s === "man" || s === "masculine") return "male";
  if (s === "f" || s === "female" || s === "woman" || s === "feminine") return "female";
  return s;
};
