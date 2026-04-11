import React, { useEffect, useState } from "react";
import CurvedWeCast from "./CurvedWeCast";
import { useTranslation } from "react-i18next";

function HeroSection() {
  const { t } = useTranslation();
  const [flashMessage, setFlashMessage] = useState("");

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

      <div className="section-shell section-block relative grid grid-cols-1 items-center gap-8 pt-12 sm:pt-16 lg:grid-cols-2 lg:gap-10 lg:pt-24">
        <div className="order-1 space-y-4 text-left sm:space-y-5">
          <h1 className="max-w-[11ch] text-[2.55rem] font-black leading-[0.95] tracking-tight text-black sm:max-w-xl sm:text-6xl dark:text-gray-100">
            {t("Give Your Words a Voice with WeCast")}
          </h1>
          <p className="max-w-[32rem] text-lg leading-8 text-black/78 sm:text-[1.35rem] dark:text-gray-200">
            {t("Hero Description")}
          </p>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap sm:items-center">
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
              {t("Learn More")}
            </a>
          </div>
        </div>

        <div className="order-2 relative min-h-[250px] sm:min-h-[300px] md:min-h-[350px]">
          <div className="absolute left-1/2 top-[56%] z-20 w-fit -translate-x-1/2 -translate-y-1/2 sm:top-1/2">
            <div dir="ltr" className="inline-block drop-shadow-md">
              <CurvedWeCast variant="heroStable" className="text-[4.25rem] sm:text-6xl md:text-7xl" />
            </div>
          </div>

          <div className="absolute left-[8%] top-[18%] rotate-12 text-sm font-semibold text-black dark:text-gray-100 sm:text-base">
            <span className="animate-pulse body-sm">{t("Start Casting!!")}</span>
            <div className="relative mt-2 h-6 w-6">
              <div className="absolute inset-0 rounded-full bg-pink-bright animate-spin" />
              <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-orange-bright animate-pulse" />
              <div className="absolute left-2 top-2 h-2 w-2 rounded-full bg-black dark:bg-white" />
            </div>
          </div>

          <div className="absolute right-[2%] top-[18%] -rotate-12 text-sm font-semibold text-black dark:text-gray-100 sm:text-base">
            <span className="animate-pulse body-sm">{t("Turn Text to speech!")}</span>
            <div className="relative mt-2 h-6 w-6">
              <div className="absolute inset-0 rounded-full bg-blue-bright animate-spin" style={{ animationDirection: "reverse" }} />
              <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-yellow-bright animate-pulse" />
              <div className="absolute left-2 top-2 h-2 w-2 rounded-full bg-black dark:bg-white" />
            </div>
          </div>

          <div className="pointer-events-none absolute left-[16%] top-[62%] z-10 h-4 w-4 rounded-full bg-purple-medium animate-bounce" />
          <div className="pointer-events-none absolute right-[14%] top-[66%] z-10 h-3 w-3 rounded-full bg-green-bright animate-pulse" />
          <div className="pointer-events-none absolute right-[4%] top-[62%] z-10 h-5 w-5 rounded-full bg-yellow-bright/90 animate-pulse sm:h-6 sm:w-6 sm:top-[56%] sm:right-[2%]" />
          <div className="pointer-events-none absolute left-[26%] top-[8%] z-10 h-8 w-8 rounded-full border-2 border-purple-medium/60 animate-pulse sm:h-10 sm:w-10" />
          <div className="pointer-events-none absolute right-[20%] top-[18%] z-10 h-8 w-8 rounded-full border-2 border-pink-bright/70 animate-pulse sm:h-10 sm:w-10" style={{ animationDelay: "0.5s" }} />

          <div className="pointer-events-none absolute left-[30%] top-[30%] z-10 h-2.5 w-2.5 rounded-full bg-pink-bright animate-bounce" />
          <div className="pointer-events-none absolute left-[44%] top-[74%] z-10 h-3 w-3 rounded-full bg-blue-bright animate-pulse sm:top-[68%]" />
          <div className="pointer-events-none absolute right-[28%] top-[30%] z-10 h-3 w-3 rounded-full bg-orange-bright animate-bounce" style={{ animationDelay: "0.2s" }} />
          <div className="pointer-events-none absolute right-[36%] top-[66%] z-10 hidden h-9 w-9 rounded-full border-2 border-green-bright/70 animate-pulse sm:block sm:top-[58%]" style={{ animationDelay: "0.35s" }} />
          <div className="pointer-events-none absolute left-[38%] top-[22%] z-10 hidden text-lg text-purple-medium/80 animate-pulse sm:block">*</div>
          <div className="pointer-events-none absolute right-[34%] top-[76%] z-10 hidden text-base text-pink-bright/80 animate-bounce sm:block sm:top-[70%]">+</div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
