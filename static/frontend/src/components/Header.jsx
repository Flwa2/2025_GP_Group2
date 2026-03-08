// src/components/Header.jsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe2 } from "lucide-react";

export default function Header() {
  const [loggedIn, setLoggedIn] = useState(false);
  const { i18n, t } = useTranslation();

  const setLanguage = (newLang) => {
    if (i18n.language === newLang) return;
    i18n.changeLanguage(newLang);

    // Store preference
    localStorage.setItem("wecast-lang", newLang);

    // Updates direction dynamically
    document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
  };

  useEffect(() => {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    setLoggedIn(!!token);

    const handleStorage = (e) => {
      if (e.key === "token") {
        setLoggedIn(!!e.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const scrollToTop = () => {
    window.location.hash = "#/";
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/20 dark:bg-black/40 backdrop-blur-md border-b border-black/10 dark:border-white/10 text-black dark:text-white">
      <nav className="section-shell h-16 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2 justify-self-start">
          <button onClick={scrollToTop} className="shrink-0" aria-label="Go to home">
            <img
              src="/logo.png"
              alt="WeCast logo"
              className="h-8 w-8 object-contain"
            />
          </button>
          <button onClick={scrollToTop} className="corner-logo block min-w-0">
            <strong
              className="truncate text-xl font-semibold tracking-tight text-black sm:text-2xl dark:text-white"
              style={{ fontFamily: "\"Playfair Display\", \"Cormorant Garamond\", Georgia, serif" }}
            >
              WeCast
            </strong>
          </button>
        </div>

        <ul className="hidden items-center gap-8 text-base font-medium md:flex justify-self-center">
          <li>
            <button
              onClick={scrollToTop}
              className="transition-colors duration-200 hover:text-purple-600"
            >
              {t("Home")}
            </button>
          </li>

          {loggedIn && (
            <li>
              <a
                href="#/episodes"
                className="transition-colors duration-200 hover:text-purple-600"
              >
                {t("episodes.sidebar.library")}
              </a>
            </li>
          )}

          {loggedIn && (
            <li>
              <a
                href="#/account"
                className="transition-colors duration-200 hover:text-purple-600"
              >
                {t("Profile")}
              </a>
            </li>
          )}
        </ul>

        <div className="flex items-center gap-3 sm:gap-4 justify-self-end">
          <button
            type="button"
            onClick={() => setLanguage(i18n.language === "ar" ? "en" : "ar")}
            className="inline-flex h-11 min-w-[138px] items-center justify-center gap-2.5 rounded-xl border border-black/15 bg-white/22 px-3.5 text-base font-semibold tracking-[0.01em] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_4px_12px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-colors duration-200 hover:bg-white/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black/10 dark:border-white/20 dark:bg-white/10 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_4px_12px_rgba(0,0,0,0.25)] dark:hover:bg-white/14 dark:focus-visible:ring-white/20"
            aria-label="Change language"
            title={i18n.language === "ar" ? "Switch to English" : "Switch to Arabic"}
          >
            <span className="inline-flex h-6 w-6 items-center justify-center text-black dark:text-white">
              <Globe2 className="h-3.5 w-3.5" />
            </span>
            <span className="inline-flex items-center gap-1.5 leading-none">
              <span
                className={`min-w-[34px] rounded-md px-2 py-1 text-center text-xs transition-colors duration-200 ${
                  i18n.language === "en"
                    ? "bg-black text-white shadow-sm dark:bg-white dark:text-black"
                    : "text-black/70 dark:text-white/70"
                }`}
              >
                EN
              </span>
              <span className="text-black/45 dark:text-white/45">|</span>
              <span
                className={`min-w-[34px] rounded-md px-2 py-1 text-center text-xs transition-colors duration-200 ${
                  i18n.language === "ar"
                    ? "bg-black text-white shadow-sm dark:bg-white dark:text-black"
                    : "text-black/70 dark:text-white/70"
                }`}
              >
                AR
              </span>
            </span>
          </button>

          {!loggedIn && (
            <div className="flex items-center gap-2 sm:gap-3">
              <a
                href="#/login"
                className="btn-secondary px-4"
              >
                {t("Login")}
              </a>

              <a
                href="#/signup"
                className="btn-primary px-5"
              >
                {t("Signup")}
              </a>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
