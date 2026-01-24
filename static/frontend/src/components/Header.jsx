// src/components/Header.jsx
import { useEffect, useState } from "react";
import CurvedWeCast from "./CurvedWeCast";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

export default function Header() {
  const [loggedIn, setLoggedIn] = useState(false);
  const { i18n, t } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(newLang);

    // Store preference
    localStorage.setItem("wecast-lang", newLang);

    // Updates direction dynamically
    document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
  };

  const goEpisodes = (e) => {
    e.preventDefault();
    // always land on home then smooth-scroll to #episodes
    window.location.hash = "#/";
    setTimeout(() => {
      const el = document.querySelector("#episodes");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
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
      <nav className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* LEFT: logo + animated WeCast */}
        <div className="flex items-center gap-2">
          <button onClick={scrollToTop}>
            <img
              src="/logo.png"
              alt="WeCast logo"
              className="w-8 h-8 object-contain"
            />
          </button>
          <button onClick={scrollToTop} className="corner-logo block">
            <strong className="text-3xl md:text-2xl font-black tracking-wide text-black dark:text-white">
              WeCast
            </strong>
          </button>

        </div>

        {/* CENTER: navigation links */}
        <ul className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6 text-base">
          <li>
            <button
              onClick={scrollToTop}
              className="transition-colors duration-300 hover:text-purple-600"
            >
              {t("Home")}
            </button>

          </li>

          {/* Episodes only when logged in */}
          {loggedIn && (
            <li>
              <a
                href="#/episodes"
                className="transition-colors duration-300 hover:text-purple-600"
              >
                {t("Episodes")}
              </a>
            </li>
          )}

          {/* Profile only when logged in */}
          {loggedIn && (
            <li>
              <a
                href="#/account"
                className="transition-colors duration-300 hover:text-purple-600"
              >
                {t("Profile")}
              </a>
            </li>
          )}
        </ul>

        {/* RIGHT: auth buttons */}
        <div className="flex items-center gap-3">
          {/* Language Icon button */}
          <button
            onClick={toggleLanguage}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-300
                          dark:border-gray-600 bg-white dark:bg-gray-900 hover:bg-gray-100 
                          dark:hover:bg-gray-800 transition"
            aria-label="Change language"
          >
            <Globe
              className="w-5 h-5 text-gray-700 dark:text-gray-300"
              style={{ transform: i18n.language === "ar" ? "scaleX(-1)" : "none" }}
            />
          </button>

          {!loggedIn && (
            <>
              <a
                href="#/login"
                className="px-3 py-1.5 rounded-lg text-black dark:text-gray-100 font-normal transition-all duration-300 hover:font-semibold hover:underline underline-offset-4"
                style={{ backgroundColor: "transparent", border: "none" }}
              >
                {t("Login")}
              </a>

              <a
                href="#/signup"
                className="px-3 py-1.5 rounded-lg bg-black text-white font-bold border-2 border-black transition-all duration-300 hover:bg-pink-200 hover:text-black"
              >
                {t("Signup")}
              </a>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
