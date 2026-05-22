/**
 * Run: node static/frontend/src/utils/strictVoicePool.selftest.mjs
 * Quick checks for strict language/accent filtering.
 */
import { getStrictFilteredVoicePool } from "./strictVoicePool.js";
import { strictVoiceMatchesLanguageAccent } from "./strictVoiceFilter.js";

const americanMale = { language: "en", accent: "american", gender: "male" };

const fixtures = {
  americanEnUs: {
    name: "Rachel US",
    gender: "female",
    languageAccents: [{ language: "en", locale: "en-US", accent: "" }],
    labels: { locale: "en-US", language: "en" },
  },
  latinoMarketing: {
    name: "Alejandro Gende",
    languageAccents: [
      { language: "es", locale: "es-MX", accent: "Latin American" },
      { language: "en", locale: "en-US", accent: "American" },
    ],
    labels: { language: "English", accent: "American" },
  },
  swedishEnglishLabel: {
    name: "Hansi",
    languageAccents: [{ language: "sv", locale: "sv-SE", accent: "" }],
    labels: { language: "English", descriptive: "Swedish" },
  },
  globalVoice: {
    name: "Kai",
    labels: { language: "en", accent: "Global", locale: "en" },
    languageAccents: [{ language: "en", locale: "en", accent: "Global" }],
  },
  britishEnGb: {
    name: "British Host",
    languageAccents: [{ language: "en", locale: "en-GB", accent: "British" }],
  },
  indianEnIn: {
    name: "Indian Host",
    languageAccents: [{ language: "en", locale: "en-IN", accent: "Indian" }],
  },
  australianEnAu: {
    name: "Aussie Host",
    languageAccents: [{ language: "en", locale: "en-AU", accent: "Australian" }],
  },
  arabicSaudi: {
    name: "Saudi Host",
    languageAccents: [{ language: "ar", locale: "ar-SA", accent: "" }],
  },
};

const catalog = Object.values(fixtures);

const cases = [
  { label: "English + American", applied: { language: "en", accent: "american" }, expectNames: ["Rachel US"] },
  { label: "English + British", applied: { language: "en", accent: "british" }, expectNames: ["British Host"] },
  { label: "English + Indian", applied: { language: "en", accent: "indian" }, expectNames: ["Indian Host"] },
  { label: "English + Australian", applied: { language: "en", accent: "australian" }, expectNames: ["Aussie Host"] },
  { label: "Arabic + Saudi", applied: { language: "ar", accent: "arabic-saudi" }, expectNames: ["Saudi Host"] },
  { label: "No lang/accent/gender", applied: {}, expectMin: catalog.length },
];

let failed = 0;
for (const testCase of cases) {
  const pool = getStrictFilteredVoicePool(catalog, testCase.applied);
  const names = pool.map((v) => v.name);
  if (testCase.expectNames) {
    const ok =
      testCase.expectNames.every((n) => names.includes(n)) &&
      names.length === testCase.expectNames.length;
    if (!ok) {
      failed += 1;
      console.error(`FAIL ${testCase.label}: got ${JSON.stringify(names)}`);
    } else {
      console.log(`PASS ${testCase.label}`);
    }
  } else if (testCase.expectMin && pool.length < testCase.expectMin) {
    failed += 1;
    console.error(`FAIL ${testCase.label}: count ${pool.length}`);
  } else {
    console.log(`PASS ${testCase.label} (${pool.length} voices)`);
  }
}

if (!strictVoiceMatchesLanguageAccent(fixtures.latinoMarketing, americanMale).pass) {
  console.log("PASS Latino mixed metadata rejected for American");
} else {
  failed += 1;
  console.error("FAIL Latino mixed metadata should not match American");
}

process.exit(failed ? 1 : 0);
