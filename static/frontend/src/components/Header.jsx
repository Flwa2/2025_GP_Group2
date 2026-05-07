// src/components/Header.jsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Globe2, Menu, X } from "lucide-react";

export default function Header() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [hash, setHash] = useState(window.location.hash || "#/");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(null);
  const { i18n, t } = useTranslation();
  const isRTL = i18n.language === "ar";

  const setLanguage = (newLang) => {
    if (i18n.language !== newLang) {
      i18n.changeLanguage(newLang);

      // Store preference
      localStorage.setItem("wecast-lang", newLang);

      // Updates direction dynamically
      document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
    }
    setLanguageMenuOpen(null);
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

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!languageMenuOpen) return undefined;

    const closeMenu = (event) => {
      if (!event.target.closest("[data-language-selector]")) {
        setLanguageMenuOpen(null);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setLanguageMenuOpen(null);
    };

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [languageMenuOpen]);

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

  const LanguageSelector = ({ id }) => {
    const open = languageMenuOpen === id;
    const options = [
      { code: "en", label: "English" },
      { code: "ar", label: "Arabic" },
    ];

    return (
      <div className="relative inline-flex shrink-0" data-language-selector>
        <button
          type="button"
          onClick={() => setLanguageMenuOpen(open ? null : id)}
          className="inline-flex h-11 w-[3.25rem] items-center justify-center gap-1.5 bg-transparent text-current opacity-90 transition-opacity hover:opacity-70 focus-visible:outline-none"
          aria-label="Change language"
          aria-haspopup="menu"
          aria-expanded={open}
          title="Change language"
        >
          <Globe2 className="h-[18px] w-[18px]" aria-hidden="true" />
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>

        {open && (
          <div
            className={`absolute top-full z-50 mt-2 w-40 overflow-hidden rounded-xl border border-black/10 bg-white/96 p-1.5 text-black shadow-[0_18px_45px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[#1a1b2e]/98 dark:text-white/95 dark:shadow-[0_18px_45px_rgba(0,0,0,0.4)] ${
              isRTL ? "left-0 text-right" : "right-0 text-left"
            }`}
            role="menu"
          >
            {options.map((option) => {
              const active = i18n.language === option.code;
              return (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => setLanguage(option.code)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                    active
                      ? "bg-black text-white dark:bg-purple-600/90 dark:text-white"
                      : "hover:bg-black/5 dark:hover:bg-purple-500/12"
                  }`}
                  role="menuitemradio"
                  aria-checked={active}
                >
                  <span>{option.label}</span>
                  {active && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <header className={`fixed inset-x-0 top-0 z-50 min-w-0 border-b text-black dark:text-white ${
      "bg-white/78 border-black/10 shadow-[0_10px_30px_rgba(15,23,42,0.08)] supports-[backdrop-filter]:bg-white/62 supports-[backdrop-filter]:backdrop-blur-xl dark:bg-[#0f1020]/82 dark:border-white/10 dark:shadow-[0_10px_30px_rgba(0,0,0,0.28)] dark:supports-[backdrop-filter]:bg-[#0f1020]/70"
    }`}>
      <nav className="section-shell flex h-16 items-center justify-between gap-3 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="flex min-w-0 shrink-0 items-center gap-2 md:justify-self-start">
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

        <ul className="hidden min-w-0 max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 text-base font-medium md:flex md:justify-self-center lg:gap-x-8">
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

        <div className="hidden min-w-0 max-w-full flex-wrap items-center justify-end gap-2 md:flex md:justify-self-end sm:gap-3 lg:flex-nowrap lg:gap-4">
          <LanguageSelector id="desktop" />

          {!loggedIn && (
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
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

        <div className="flex shrink-0 items-center gap-1 md:hidden">
          <LanguageSelector id="mobile-header" />
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex h-11 w-[3.25rem] shrink-0 items-center justify-center bg-transparent text-current opacity-90 transition-[opacity,transform] duration-200 hover:opacity-100 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500/45"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="h-[18px] w-[18px]" aria-hidden="true" />
            ) : (
              <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu: grid row animation + inner fade/slide; dark panel matches header */}
      <div
        className={`md:hidden grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          mobileMenuOpen
            ? "grid-rows-[1fr] border-t border-black/10 dark:border-white/10"
            : "grid-rows-[0fr] border-t border-transparent"
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={`rounded-b-2xl px-4 pb-5 pt-2 transition-[opacity,transform] duration-300 ease-out sm:px-5 ${
              mobileMenuOpen
                ? "translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-1.5 opacity-0"
            } bg-[#faf8f4]/98 shadow-[0_20px_48px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:bg-[#141528]/98 dark:shadow-[0_24px_56px_rgba(0,0,0,0.45)]`}
          >
            <div className="mx-auto w-full max-w-md rounded-2xl px-1 py-1">
              <nav
                className="flex flex-col gap-1"
                aria-label="Mobile"
              >
                {mobileLinks.map((item) => {
                  const align = isRTL ? "text-end" : "text-start";
                  const itemClass =
                    `block w-full rounded-xl px-4 py-3.5 text-sm font-semibold transition-colors duration-200 ` +
                    `text-neutral-900 hover:bg-black/[0.06] active:bg-black/[0.08] ` +
                    `dark:text-white/95 dark:hover:bg-purple-500/15 dark:active:bg-purple-500/22 ` +
                    align;
                  return item.href ? (
                    <a key={item.label} href={item.href} className={itemClass}>
                      {item.label}
                    </a>
                  ) : (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.action}
                      className={itemClass}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </nav>

              {!loggedIn && (
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-black/10 pt-4 dark:border-white/10">
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
        </div>
      </div>
    </header>
  );
}
