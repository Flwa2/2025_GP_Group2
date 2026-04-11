import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ar from "./locales/ar.json";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar }
  },
  lng: localStorage.getItem("wecast-lang") || localStorage.getItem("lang") || "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false }
});

// Ensure document direction follows the active language
const applyDir = (lng) => {
  if (typeof document !== "undefined") {
    document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
  }
};

applyDir(i18n.language);
i18n.on("languageChanged", applyDir);

export default i18n;
