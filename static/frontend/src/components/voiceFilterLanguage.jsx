import React from "react";
import { useTranslation } from "react-i18next";

const LANGUAGE_LABELS = {
  en: { flagCode: "gb", key: "english", name: "English" },
  "en-us": { flagCode: "gb", key: "english", name: "English" },
  "en-gb": { flagCode: "gb", key: "english", name: "English" },

  ar: { flagCode: "sa", key: "arabic", name: "Arabic" },
  "ar-sa": { flagCode: "sa", key: "arabic", name: "Arabic" },

  zh: { flagCode: "cn", name: "Chinese" },
  "zh-cn": { flagCode: "cn", name: "Chinese" },
  cmn: { flagCode: "cn", name: "Chinese" },
  yue: { flagCode: "cn", name: "Chinese" },
  fr: { flagCode: "fr", name: "French" },
  es: { flagCode: "es", name: "Spanish" },
  de: { flagCode: "de", name: "German" },
  it: { flagCode: "it", name: "Italian" },
  ja: { flagCode: "jp", name: "Japanese" },
  ko: { flagCode: "kr", name: "Korean" },
  pt: { flagCode: "pt", name: "Portuguese" },
  "pt-br": { flagCode: "pt", name: "Portuguese" },
  hi: { flagCode: "in", name: "Hindi" },
  ms: { flagCode: "my", name: "Malay" },
  nl: { flagCode: "nl", name: "Dutch" },
  pl: { flagCode: "pl", name: "Polish" },
  ru: { flagCode: "ru", name: "Russian" },
  tr: { flagCode: "tr", name: "Turkish" },
  sv: { flagCode: "se", name: "Swedish" },
  no: { flagCode: "no", name: "Norwegian" },
  da: { flagCode: "dk", name: "Danish" },
  fi: { flagCode: "fi", name: "Finnish" },
  id: { flagCode: "id", name: "Indonesian" },
  vi: { flagCode: "vn", name: "Vietnamese" },
  th: { flagCode: "th", name: "Thai" },
  fil: { flagCode: "ph", name: "Filipino" },
  tl: { flagCode: "ph", name: "Filipino" },
  uk: { flagCode: "ua", name: "Ukrainian" },
  cs: { flagCode: "cz", name: "Czech" },
  el: { flagCode: "gr", name: "Greek" },
  hu: { flagCode: "hu", name: "Hungarian" },
  ro: { flagCode: "ro", name: "Romanian" },
  bg: { flagCode: "bg", name: "Bulgarian" },
  hr: { flagCode: "hr", name: "Croatian" },
  sk: { flagCode: "sk", name: "Slovak" },
  ta: { flagCode: "in", name: "Tamil" },
  bn: { flagCode: "bd", name: "Bengali" },
  ur: { flagCode: "pk", name: "Urdu" },
  fa: { flagCode: "ir", name: "Persian" },
  he: { flagCode: "il", name: "Hebrew" },
};

const LANGUAGE_NAME_TO_CODE = Object.entries(LANGUAGE_LABELS).reduce(
  (acc, [code, info]) => {
    acc[info.name.toLowerCase()] = code.split("-")[0];
    return acc;
  },
  {}
);

export const VOICE_LANGUAGE_OPTIONS = ["en", "ar"];

export const normalizeLanguageFilterValue = (value) => {
  const raw = String(value || "").trim().toLowerCase().replace("_", "-");
  if (!raw) return "";

  if (raw === "arabic" || raw.startsWith("arabic ") || raw.startsWith("arabic(")) {
    return "ar";
  }

  if (raw === "english" || raw.startsWith("english ") || raw.startsWith("english(")) {
    return "en";
  }

  if (LANGUAGE_NAME_TO_CODE[raw]) return LANGUAGE_NAME_TO_CODE[raw];
  if (LANGUAGE_LABELS[raw]) return raw.split("-")[0];

  const base = raw.split("-")[0];
  return LANGUAGE_LABELS[base] ? base : raw;
};

const formatLanguageLabel = (value) => {
  const fallback = String(value || "").trim();
  if (!fallback) return "";

  return fallback
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const getLanguageDisplay = (value, t) => {
  const normalized = normalizeLanguageFilterValue(value);

  const info =
    LANGUAGE_LABELS[normalized] ||
    LANGUAGE_LABELS[String(value || "").trim().toLowerCase()];

  return {
    flagCode: info?.flagCode || "",
    name: info?.key
      ? t(`create.speakers.${info.key}`)
      : info?.name || formatLanguageLabel(value),
  };
};

export const uniqueLanguageOptions = () => VOICE_LANGUAGE_OPTIONS;

export function LanguageLabel({ value }) {
  const { t } = useTranslation();
  const info = getLanguageDisplay(value, t);

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {info.flagCode ? (
        <span
          className={`wecast-language-flag wecast-language-flag-${info.flagCode}`}
          aria-hidden="true"
        />
      ) : null}
      <span className="truncate">{info.name}</span>
    </span>
  );
}