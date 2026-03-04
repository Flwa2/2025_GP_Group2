import React from "react";
import { useTranslation } from "react-i18next";

export default function AboutSection() {
  const { t } = useTranslation();

  return (
    <section
      id="about"
      className="relative overflow-hidden bg-cream text-neutral-900 transition-colors duration-500 dark:bg-[#0a0a1a] dark:text-gray-100"
    >
      <div className="section-shell section-block grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
        <div className="space-y-5">
          <h2 className="heading-lg">
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

        <div className="relative mx-auto h-[320px] w-full max-w-[520px] md:h-[440px] lg:justify-self-end">
          <div className="absolute right-2 top-10 h-44 w-44 rounded-full bg-pink-bright/25 blur-3xl animate-pulse" />
          <div className="absolute bottom-4 right-14 h-36 w-36 rounded-full bg-yellow-bright/25 blur-2xl animate-bounce" />
          <div className="absolute right-40 top-5 h-20 w-20 rounded-full bg-purple-medium/20 blur-xl animate-pulse" />
          <div className="absolute right-2 bottom-20 h-24 w-24 rounded-full bg-blue-bright/20 blur-xl animate-pulse" style={{ animationDelay: "0.5s" }} />

          <img
            src="/img2.png"
            alt="WeCast microphone"
            className="absolute bottom-0 right-[-6px] w-[320px] rotate-[-18deg] select-none drop-shadow-2xl md:right-[-36px] md:w-[420px]"
          />

          <div className="pointer-events-none absolute left-0 top-8 h-3 w-14 rounded-full bg-yellow-bright/90 animate-bounce" />
          <div className="pointer-events-none absolute left-10 top-24 h-3 w-10 rounded-full bg-pink-bright/90 animate-pulse" />
          <div className="pointer-events-none absolute left-8 bottom-12 h-3 w-12 rounded-full bg-purple-medium/90 animate-bounce" style={{ animationDelay: "0.4s" }} />
          <div className="pointer-events-none absolute left-20 bottom-24 h-3 w-3 rounded-full bg-green-bright animate-pulse" />
          <div className="pointer-events-none absolute left-24 top-14 h-4 w-4 rounded-full bg-orange-bright animate-bounce" />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-800/20 via-transparent to-pink-500/10" />
    </section>
  );
}
