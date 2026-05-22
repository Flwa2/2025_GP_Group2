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
  genericEnglishMale: {
    name: "Marcus",
    gender: "male",
    labels: { language: "English", gender: "male" },
    languages: ["English"],
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
  arabicEgyptian: {
    name: "Egyptian Host",
    languageAccents: [{ language: "ar", locale: "ar-EG", accent: "egyptian" }],
  },
  arabicGenericMale: {
    name: "Omar",
    gender: "male",
    labels: { language: "Arabic", gender: "male" },
    languages: ["Arabic"],
  },
};

const catalog = Object.values(fixtures);

const cases = [
  {
    label: "English + American",
    applied: { language: "en", accent: "american", gender: "male" },
    expectNames: ["Marcus"],
    expectAlsoNames: ["Rachel US"],
  },
  { label: "English + British", applied: { language: "en", accent: "british" }, expectNames: ["British Host"] },
  { label: "English + Indian", applied: { language: "en", accent: "indian" }, expectNames: ["Indian Host"] },
  { label: "English + Australian", applied: { language: "en", accent: "australian" }, expectNames: ["Aussie Host"] },
  {
    label: "Arabic + Saudi + Male",
    applied: { language: "ar", accent: "arabic-saudi", gender: "male" },
    expectNames: ["Saudi Host"],
  },
  { label: "Arabic + Egyptian", applied: { language: "ar", accent: "arabic-egyptian" }, expectNames: ["Egyptian Host"] },
  { label: "No lang/accent/gender", applied: {}, expectMin: catalog.length },
];

let failed = 0;
for (const testCase of cases) {
  const pool = getStrictFilteredVoicePool(catalog, testCase.applied);
  const names = pool.map((v) => v.name);
  if (testCase.expectNames) {
    const requiredOk = testCase.expectNames.every((n) => names.includes(n));
    const alsoOk = (testCase.expectAlsoNames || []).every((n) => names.includes(n));
    const blocked = ["Alejandro Gende", "Hansi", "Kai"].some((n) => names.includes(n));
    const ok = requiredOk && alsoOk && !blocked && names.length > 0;
    if (!ok) {
      failed += 1;
      console.error(`FAIL ${testCase.label}: got ${JSON.stringify(names)}`);
    } else {
      console.log(`PASS ${testCase.label} (${names.length} voices)`);
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
