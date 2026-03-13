import React from "react";
import { useTranslation } from "react-i18next";

export default function AboutSection() {
  const { t } = useTranslation();

  return (
    <section
      id="about"
      className="relative overflow-hidden bg-cream text-neutral-900 transition-colors duration-500 dark:bg-[#0a0a1a] dark:text-gray-100"
    >
      <div className="section-shell section-block grid grid-cols-1 items-center gap-8 py-14 sm:gap-10 sm:py-20 lg:grid-cols-2">
        <div className="space-y-4 sm:space-y-5">
          <h2 className="heading-lg max-w-[14ch] sm:max-w-none">
            {t("AboutTitle")}{" "}
            <span className="curved-wecast font-extrabold text-black dark:text-gray-100">
              WeCast
            </span>
          </h2>

          <p className="body-md max-w-2xl text-neutral-800 dark:text-gray-300">
            {t("AboutParagraph1")}
          </p>

          <p className="body-md max-w-2xl text-neutral-800 dark:text-gray-300">
            {t("AboutParagraph2")}
          </p>

          <p className="body-md max-w-2xl italic text-neutral-700 dark:text-gray-400">
            {t("AboutQuote")}
          </p>
        </div>

        <div className="relative mx-auto mt-2 h-[240px] w-full max-w-[320px] sm:h-[320px] sm:max-w-[420px] md:h-[440px] md:max-w-[520px] lg:justify-self-end">
          <div className="absolute right-2 top-10 h-28 w-28 rounded-full bg-pink-bright/25 blur-3xl animate-pulse sm:h-44 sm:w-44" />
          <div className="absolute bottom-4 right-10 h-24 w-24 rounded-full bg-yellow-bright/25 blur-2xl animate-bounce sm:right-14 sm:h-36 sm:w-36" />
          <div className="absolute right-28 top-5 h-14 w-14 rounded-full bg-purple-medium/20 blur-xl animate-pulse sm:right-40 sm:h-20 sm:w-20" />
          <div className="absolute right-2 bottom-16 h-16 w-16 rounded-full bg-blue-bright/20 blur-xl animate-pulse sm:bottom-20 sm:h-24 sm:w-24" style={{ animationDelay: "0.5s" }} />

          <img
            src="/img2.png"
            alt="WeCast microphone"
            className="absolute bottom-0 right-[-2px] w-[230px] rotate-[-15deg] select-none drop-shadow-2xl sm:right-[-6px] sm:w-[320px] md:right-[-36px] md:w-[420px]"
          />

          <div className="pointer-events-none absolute left-0 top-8 h-2.5 w-10 rounded-full bg-yellow-bright/90 animate-bounce sm:h-3 sm:w-14" />
          <div className="pointer-events-none absolute left-10 top-20 h-2.5 w-8 rounded-full bg-pink-bright/90 animate-pulse sm:top-24 sm:h-3 sm:w-10" />
          <div className="pointer-events-none absolute left-8 bottom-8 h-2.5 w-10 rounded-full bg-purple-medium/90 animate-bounce sm:bottom-12 sm:h-3 sm:w-12" style={{ animationDelay: "0.4s" }} />
          <div className="pointer-events-none absolute left-20 bottom-20 hidden h-3 w-3 rounded-full bg-green-bright animate-pulse sm:block sm:bottom-24" />
          <div className="pointer-events-none absolute left-24 top-14 hidden h-4 w-4 rounded-full bg-orange-bright animate-bounce sm:block" />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-800/20 via-transparent to-pink-500/10" />
    </section>
  );
}
