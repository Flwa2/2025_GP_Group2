import React from "react";
import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();

  const navigateToSection = (sectionId) => {
    if (window.location.hash !== "#/" && window.location.hash !== "") {
      window.location.hash = "#/";
      setTimeout(() => {
        const el = document.querySelector(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    } else {
      const el = document.querySelector(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const scrollToTop = () => {
    window.location.hash = "#/";
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
  };

  return (
    <footer className="bg-[#ffecc6] dark:bg-[#0f1020] text-black dark:text-white transition-colors duration-500">
      <div className="h-1.5 w-full bg-[#e6c34a] dark:bg-[#8b5cf6]" />

      <div className="section-shell px-6 pt-12 pb-8 md:pt-14 md:pb-10">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-12 items-start">
          <div className="text-center md:text-left">
            <div className="mb-3 flex items-center justify-center gap-2.5 md:justify-start">
              <img
                src="/logo.png"
                alt="WeCast logo"
                className="h-8 w-8 object-contain"
              />
              <h4
                className="text-3xl font-semibold tracking-tight leading-none"
                style={{ fontFamily: "\"Playfair Display\", \"Cormorant Garamond\", Georgia, serif" }}
              >
                WeCast
              </h4>
            </div>
            <p className="body-sm mx-auto max-w-xs text-black/75 dark:text-white/75 md:mx-0">
              {t("footer.tagline")}
            </p>
          </div>

          <div className="text-center md:pl-12 md:text-left lg:pl-16">
            <h5 className="heading-md mb-4 leading-none">{t("footer.quickLinks")}</h5>
            <ul className="space-y-3 text-base font-medium text-black/88 dark:text-white/88">
              <li>
                <button
                  onClick={scrollToTop}
                  className="group inline-flex items-center gap-3 hover:opacity-80 transition cursor-pointer"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444] group-hover:scale-125 transition-transform" />
                  <span>{t("footer.home")}</span>
                </button>
              </li>
              <li>
                <a href="#/episodes" className="group inline-flex items-center gap-3 hover:opacity-80 transition">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e] group-hover:scale-125 transition-transform" />
                  <span>{t("Episodes")}</span>
                </a>
              </li>
              <li>
                <a
                  href="#about"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToSection("#about");
                  }}
                  className="group inline-flex items-center gap-3 hover:opacity-80 transition cursor-pointer"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-[#3b82f6] group-hover:scale-125 transition-transform" />
                  <span>{t("footer.about")}</span>
                </a>
              </li>
              <li>
                <a href="#/create" className="group inline-flex items-center gap-3 hover:opacity-80 transition">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b] group-hover:scale-125 transition-transform" />
                  <span>{t("footer.create")}</span>
                </a>
              </li>
            </ul>
          </div>

          <div className="text-center md:pl-12 md:text-left lg:pl-16">
            <h5 className="heading-md mb-4 leading-none">{t("footer.followPodcast")}</h5>
            <div className="mb-6 flex flex-wrap items-center justify-center gap-2.5 md:justify-start">
              <a className="h-10 w-10 rounded-full bg-[#fbbc05] inline-flex items-center justify-center text-sm font-black text-black hover:scale-105 transition-transform" href="#" aria-label="Google Podcasts">G</a>
              <a className="h-10 w-10 rounded-full bg-[#a84ad9] inline-flex items-center justify-center text-sm font-black text-white hover:scale-105 transition-transform" href="#" aria-label="Apple Podcasts">P</a>
              <a className="h-10 w-10 rounded-full bg-[#1db954] inline-flex items-center justify-center text-sm font-black text-white hover:scale-105 transition-transform" href="#" aria-label="Spotify">S</a>
              <a className="h-10 w-10 rounded-full bg-[#f9d94a] inline-flex items-center justify-center text-sm font-black text-black hover:scale-105 transition-transform" href="#" aria-label="Headphones">H</a>
              <a className="h-10 w-10 rounded-full bg-[#e83e8c] inline-flex items-center justify-center text-sm font-black text-white hover:scale-105 transition-transform" href="#" aria-label="Anchor">A</a>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="mx-auto h-px w-[94%] bg-black/20 dark:bg-white/20" />
          <p className="mt-3 text-center text-sm text-black/60 dark:text-white/60">
            © {new Date().getFullYear()} WeCast - {t("footer.rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
