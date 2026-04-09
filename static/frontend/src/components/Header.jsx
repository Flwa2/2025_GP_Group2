// src/components/Header.jsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe2, Menu, X } from "lucide-react";

export default function Header() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [hash, setHash] = useState(window.location.hash || "#/");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    const handleHashChange = () => setHash(window.location.hash || "#/");
    window.addEventListener("storage", handleStorage);
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [hash]);

  const scrollToTop = () => {
    window.location.hash = "#/";
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
  };

  const mobileLinks = [
    { label: t("Home"), action: scrollToTop },
    ...(loggedIn
      ? [{ label: t("episodes.sidebar.library"), href: "#/episodes" }]
      : []),
    ...(loggedIn
      ? [{ label: t("Profile"), href: "#/account" }]
      : []),
  ];

  return (
    <header className={`fixed top-0 inset-x-0 z-50 border-b text-black dark:text-white ${
      "bg-white/78 border-black/10 shadow-[0_10px_30px_rgba(15,23,42,0.08)] supports-[backdrop-filter]:bg-white/62 supports-[backdrop-filter]:backdrop-blur-xl dark:bg-[#0f1020]/82 dark:border-white/10 dark:shadow-[0_10px_30px_rgba(0,0,0,0.28)] dark:supports-[backdrop-filter]:bg-[#0f1020]/70"
    }`}>
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

        <div className="hidden md:flex items-center gap-3 sm:gap-4 justify-self-end">
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

        <div className="flex md:hidden items-center justify-self-end">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/15 bg-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_4px_12px_rgba(0,0,0,0.06)] backdrop-blur-xl transition hover:bg-white/30 dark:border-white/20 dark:bg-white/10 dark:hover:bg-white/14"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-black/10 bg-[#f5ead2]/95 px-4 pb-4 pt-3 shadow-[0_12px_30px_rgba(15,23,42,0.10)] backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/94">
          <div className="space-y-3">
            <div className="rounded-2xl border border-black/10 bg-white/70 p-2 dark:border-white/10 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setLanguage(i18n.language === "ar" ? "en" : "ar")}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-black/5 dark:hover:bg-white/10"
              >
                <span className="inline-flex items-center gap-2">
                  <Globe2 className="h-4 w-4" />
                  Language
                </span>
                <span className="rounded-lg bg-black px-2 py-1 text-xs text-white dark:bg-white dark:text-black">
                  {i18n.language === "ar" ? "AR" : "EN"}
                </span>
              </button>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/70 p-2 dark:border-white/10 dark:bg-white/5">
              {mobileLinks.map((item) =>
                item.href ? (
                  <a
                    key={item.label}
                    href={item.href}
                    className="block rounded-xl px-3 py-3 text-sm font-semibold transition hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    {item.label}
                  </a>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    className="block w-full rounded-xl px-3 py-3 text-left text-sm font-semibold transition hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    {item.label}
                  </button>
                )
              )}
            </div>

            {!loggedIn && (
              <div className="grid grid-cols-2 gap-3">
                <a href="#/login" className="btn-secondary px-4 text-center">
                  {t("Login")}
                </a>
                <a href="#/signup" className="btn-primary px-4 text-center">
                  {t("Signup")}
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
