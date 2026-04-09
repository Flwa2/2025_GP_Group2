import React, { useEffect, useState } from "react";
import CurvedWeCast from "./CurvedWeCast";
import { useTranslation } from "react-i18next";

function HeroSection() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [flashMessage, setFlashMessage] = useState("");
  const heroTitleLines = String(t("Give Your Words a Voice with WeCast")).split("\n");

  useEffect(() => {
    const msg = sessionStorage.getItem("wecast:flash");
    if (msg) {
      setFlashMessage(msg);
      sessionStorage.removeItem("wecast:flash");
      const timeoutId = setTimeout(() => setFlashMessage(""), 4000);
      return () => clearTimeout(timeoutId);
    }
  }, []);

  const navigateToCreate = () => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    window.location.hash = token ? "#/create" : "#/login?redirect=create";
  };

  return (
    <section className="relative overflow-hidden bg-cream text-black transition-colors duration-500 dark:bg-[#0a0a1a] dark:text-white">
      {flashMessage && (
        <div className="absolute left-0 right-0 top-4 z-20 flex justify-center px-4">
          <div className="mx-auto mt-8 flex w-full max-w-xl items-center justify-between rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-green-700 shadow-sm dark:border-green-700 dark:bg-green-900/20 dark:text-green-300">
            <span className="text-sm font-medium md:text-base">{flashMessage}</span>
            <button
              onClick={() => setFlashMessage("")}
              className="ml-3 rounded-md px-3 py-1 text-sm font-medium transition hover:bg-white/80 dark:hover:bg-green-800/50"
            >
              {t("create.common.close")}
            </button>
          </div>
        </div>
      )}

      <div className="section-shell section-block relative grid grid-cols-1 items-center gap-8 pt-8 sm:pt-16 lg:grid-cols-2 lg:gap-10 lg:pt-24">
        <div className={`order-1 space-y-3 sm:space-y-5 ${isRTL ? "text-right" : "text-left"}`}>
          <h1 className={`text-[2.05rem] font-black leading-[0.94] tracking-tight text-black min-[380px]:text-[2.25rem] sm:text-6xl dark:text-gray-100 ${isRTL ? "ml-auto max-w-[12.4ch] sm:max-w-[12.8ch]" : "max-w-[12ch] min-[380px]:max-w-[13ch] sm:max-w-xl"}`}>
            {heroTitleLines.map((line, index) => (
              <span key={`${line}-${index}`} className="block whitespace-nowrap">
                {line}
              </span>
            ))}
          </h1>
          <p className={`text-[0.98rem] leading-7 text-black/78 sm:text-[1.35rem] sm:leading-8 dark:text-gray-200 ${isRTL ? "ml-auto max-w-[32rem]" : "max-w-[32rem]"}`}>
            {t("Hero Description")}
          </p>
          <div className={`flex flex-col gap-3 pt-1 sm:flex-wrap sm:items-center ${isRTL ? "w-full sm:ml-auto sm:max-w-[32rem] sm:flex-row sm:justify-start" : "sm:flex-row"}`}>
            <button
              onClick={navigateToCreate}
              className="btn-primary w-full justify-center sm:w-auto"
            >
              {t("Let's WeCast It")}
            </button>
            <a
              href="#about"
              className="btn-secondary w-full justify-center text-center sm:w-auto"
            >
              {isRTL ? "اعرف المزيد" : t("Learn More")}
            </a>
          </div>
        </div>

        <div className="order-2 relative min-h-[200px] sm:min-h-[300px] md:min-h-[350px]">
          <div className="absolute left-1/2 top-[50%] z-20 w-fit -translate-x-1/2 -translate-y-1/2 sm:top-1/2">
            <div dir="ltr" className="inline-block">
              <CurvedWeCast
                variant="heroStable"
                className="text-[3.2rem] min-[380px]:text-[3.7rem] sm:text-6xl md:text-7xl"
              />
            </div>
          </div>

          <div className="absolute left-[8%] top-[18%] hidden rotate-12 text-sm font-semibold text-black dark:text-gray-100 sm:block sm:text-base">
            <span className="animate-pulse body-sm">{t("Start Casting!!")}</span>
            <div className="relative mt-2 h-6 w-6">
              <div className="absolute inset-0 rounded-full bg-pink-bright animate-spin" />
              <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-orange-bright animate-pulse" />
              <div className="absolute left-2 top-2 h-2 w-2 rounded-full bg-black dark:bg-white" />
            </div>
          </div>

          <div className="absolute right-[2%] top-[18%] hidden -rotate-12 text-sm font-semibold text-black dark:text-gray-100 sm:block sm:text-base">
            <span className="animate-pulse body-sm">{t("Turn Text to speech!")}</span>
            <div className="relative mt-2 h-6 w-6">
              <div className="absolute inset-0 rounded-full bg-blue-bright animate-spin" style={{ animationDirection: "reverse" }} />
              <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-yellow-bright animate-pulse" />
              <div className="absolute left-2 top-2 h-2 w-2 rounded-full bg-black dark:bg-white" />
            </div>
          </div>

          <div className="pointer-events-none absolute left-[16%] top-[62%] z-10 h-3.5 w-3.5 rounded-full bg-purple-medium animate-bounce sm:h-4 sm:w-4 sm:top-[62%]" />
          <div className="pointer-events-none absolute right-[14%] top-[64%] z-10 h-3 w-3 rounded-full bg-green-bright animate-pulse sm:top-[66%]" />
          <div className="pointer-events-none absolute right-[8%] top-[58%] z-10 h-4 w-4 rounded-full bg-yellow-bright/90 animate-pulse sm:h-6 sm:w-6 sm:top-[56%] sm:right-[2%]" />
          <div className="pointer-events-none absolute left-[24%] top-[12%] z-10 hidden h-8 w-8 rounded-full border-2 border-purple-medium/60 animate-pulse sm:block sm:h-10 sm:w-10" />
          <div className="pointer-events-none absolute right-[20%] top-[18%] z-10 hidden h-8 w-8 rounded-full border-2 border-pink-bright/70 animate-pulse sm:block sm:h-10 sm:w-10" style={{ animationDelay: "0.5s" }} />

          <div className="pointer-events-none absolute left-[28%] top-[28%] z-10 h-2.5 w-2.5 rounded-full bg-pink-bright animate-bounce" />
          <div className="pointer-events-none absolute left-[44%] top-[70%] z-10 h-3 w-3 rounded-full bg-blue-bright animate-pulse sm:top-[68%]" />
          <div className="pointer-events-none absolute right-[26%] top-[28%] z-10 h-3 w-3 rounded-full bg-orange-bright animate-bounce" style={{ animationDelay: "0.2s" }} />
          <div className="pointer-events-none absolute right-[36%] top-[66%] z-10 hidden h-9 w-9 rounded-full border-2 border-green-bright/70 animate-pulse sm:block sm:top-[58%]" style={{ animationDelay: "0.35s" }} />
          <div className="pointer-events-none absolute left-[38%] top-[22%] z-10 hidden text-lg text-purple-medium/80 animate-pulse sm:block">*</div>
          <div className="pointer-events-none absolute right-[34%] top-[76%] z-10 hidden text-base text-pink-bright/80 animate-bounce sm:block sm:top-[70%]">+</div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
