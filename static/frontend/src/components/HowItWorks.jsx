import React from "react";
import StepCard from "./StepCard";
import { useTranslation } from "react-i18next";

export default function HowItWorks() {
  const { t } = useTranslation();

  return (
    <section className="bg-[#e9e2ff] text-black transition-colors duration-500 dark:bg-[#0a0a1a] dark:text-white">
      <div className="section-shell section-block">
        <h2 className="heading-lg text-center text-black dark:text-gray-100">
          {t("How WeCast Works")}
        </h2>

        <p className="body-md mx-auto mt-4 max-w-2xl text-center text-black/75 dark:text-gray-300">
          {t("HowItWorks Line1")}
          <br />
          {t("HowItWorks Line2")}
        </p>

        <ol className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          <StepCard
            delay={0}
            className="group relative rounded-2xl border border-black/10 bg-white/80 p-6 backdrop-blur transition-all duration-300 hover:border-black/20 dark:border-white/10 dark:bg-[#12121f]/85 dark:hover:border-white/20"
          >
            <div className="absolute -left-2 -top-2 grid h-9 w-9 place-items-center rounded-full bg-black text-lg font-bold text-white dark:bg-white dark:text-black">
              1
            </div>
            <h3 className="heading-md mb-3 text-black dark:text-white">
              {t("Step1 Title")}
            </h3>
            <p className="body-sm text-black/80 dark:text-gray-300">{t("Step1 Body")}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {["Interview", "Educational", "Storytelling", "Conversational"].map((translationKey, i) => (
                <span
                  key={i}
                  className="inline-block rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-3 py-1 text-sm font-medium text-white"
                >
                  {t(translationKey)}
                </span>
              ))}
            </div>
          </StepCard>

          <StepCard
            delay={150}
            className="group relative rounded-2xl border border-black/10 bg-white/80 p-6 backdrop-blur transition-all duration-300 hover:border-black/20 dark:border-white/10 dark:bg-[#12121f]/85 dark:hover:border-white/20"
          >
            <div className="absolute -left-2 -top-2 grid h-9 w-9 place-items-center rounded-full bg-black text-lg font-bold text-white dark:bg-white dark:text-black">
              2
            </div>
            <h3 className="heading-md mb-3 text-black dark:text-white">
              {t("Step2 Title")}
            </h3>
            <p className="body-sm text-black/80 dark:text-gray-300">{t("Step2 Body")}</p>
          </StepCard>

          <StepCard
            delay={300}
            className="group relative rounded-2xl border border-black/10 bg-white/80 p-6 backdrop-blur transition-all duration-300 hover:border-black/20 dark:border-white/10 dark:bg-[#12121f]/85 dark:hover:border-white/20"
          >
            <div className="absolute -left-2 -top-2 grid h-9 w-9 place-items-center rounded-full bg-black text-lg font-bold text-white dark:bg-white dark:text-black">
              3
            </div>
            <h3 className="heading-md mb-3 text-black dark:text-white">
              {t("Step3 Title")}
            </h3>
            <p className="body-sm text-black/80 dark:text-gray-300">{t("Step3 Body")}</p>
            <p className="body-sm mt-3 font-medium text-black/75 dark:text-gray-300">{t("Step3 Tagline")}</p>
          </StepCard>
        </ol>

        <div className="mt-10 flex flex-col items-center gap-3">
          <a href="#/create" className="btn-primary">
            {t("Try WeCast Now Button")}
          </a>
          <p className="body-sm text-black/60 dark:text-gray-400">{t("No Signup Required")}</p>
        </div>
      </div>
    </section>
  );
}
