import React, { useEffect, useState } from "react";
import CurvedWeCast from "./CurvedWeCast";
import { useTranslation } from "react-i18next";

function HeroSection() {
  const { t } = useTranslation();
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
        <div className="absolute inset-x-0 top-4 z-20 flex justify-center px-4">
          <div className="mx-auto mt-8 flex min-w-0 w-full max-w-xl items-center justify-between gap-2 rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-green-700 shadow-sm dark:border-green-700 dark:bg-green-900/20 dark:text-green-300">
            <span className="min-w-0 flex-1 text-sm font-medium md:text-base">{flashMessage}</span>
            <button
              type="button"
              onClick={() => setFlashMessage("")}
              className="ms-3 shrink-0 rounded-md px-3 py-1 text-sm font-medium transition hover:bg-white/80 dark:hover:bg-green-800/50"
            >
              {t("create.common.close")}
            </button>
          </div>
        </div>
      )}

      <div className="section-shell section-block relative grid min-w-0 grid-cols-1 items-center gap-6 pt-10 sm:gap-8 sm:pt-16 lg:grid-cols-2 lg:gap-10 lg:pt-24">
        <div className="order-1 min-w-0 space-y-3 text-start sm:space-y-5">
          <h1 className="w-full min-w-0 max-w-[min(100%,20.5rem)] text-[clamp(1.95rem,5.4vw,2.45rem)] font-black leading-[1.12] tracking-tight text-black [text-wrap:balance] sm:max-w-xl sm:text-6xl sm:leading-[0.94] sm:[text-wrap:unset] dark:text-gray-100">
            {heroTitleLines.map((line, index) => (
              <span
                key={`${line}-${index}`}
                className="block max-sm:break-words sm:whitespace-nowrap"
              >
                {line}
              </span>
            ))}
          </h1>
          <p className="max-w-[32rem] text-[0.98rem] leading-7 text-black/78 sm:text-[1.35rem] sm:leading-8 dark:text-gray-200">
            {t("Hero Description")}
          </p>
          <div className="flex w-full max-w-[32rem] flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start">
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

        <div className="order-2 relative min-h-[200px] min-w-0 sm:min-h-[300px] md:min-h-[350px]">
          <div className="absolute left-1/2 top-[50%] z-20 w-fit -translate-x-1/2 -translate-y-1/2 sm:top-1/2">
            <div dir="ltr" className="inline-block">
              <CurvedWeCast
                variant="heroStable"
                className="text-[3.2rem] min-[380px]:text-[3.7rem] sm:text-6xl md:text-7xl"
              />
            </div>
          </div>

          <div className="absolute start-[5%] top-[11%] z-10 block max-w-[min(42vw,7.5rem)] rotate-12 text-[0.625rem] font-semibold leading-tight text-black dark:text-gray-100 sm:start-[8%] sm:top-[18%] sm:max-w-none sm:text-base sm:leading-normal">
            <span className="animate-pulse">{t("Start Casting!!")}</span>
            <div className="relative mt-1.5 h-5 w-5 origin-top-left scale-90 sm:mt-2 sm:h-6 sm:w-6 sm:scale-100">
              <div className="absolute inset-0 rounded-full bg-pink-bright animate-spin" />
              <div className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-orange-bright animate-pulse sm:left-1 sm:top-1 sm:h-4 sm:w-4" />
              <div className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-black dark:bg-white sm:left-2 sm:top-2 sm:h-2 sm:w-2" />
            </div>
          </div>

          <div className="absolute end-[3%] top-[11%] z-10 block max-w-[min(46vw,8.5rem)] -rotate-12 text-end text-[0.625rem] font-semibold leading-tight text-black dark:text-gray-100 sm:end-[2%] sm:top-[18%] sm:max-w-none sm:text-base sm:leading-normal sm:text-start">
            <span className="animate-pulse">{t("Turn Text to speech!")}</span>
            <div className="relative mt-1.5 ms-auto h-5 w-5 origin-top-right scale-90 sm:ms-0 sm:mt-2 sm:h-6 sm:w-6 sm:scale-100">
              <div className="absolute inset-0 rounded-full bg-blue-bright animate-spin" style={{ animationDirection: "reverse" }} />
              <div className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-yellow-bright animate-pulse sm:left-1 sm:top-1 sm:h-4 sm:w-4" />
              <div className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-black dark:bg-white sm:left-2 sm:top-2 sm:h-2 sm:w-2" />
            </div>
          </div>

          <div className="pointer-events-none absolute left-[16%] top-[62%] z-10 h-3.5 w-3.5 rounded-full bg-purple-medium animate-bounce sm:h-4 sm:w-4 sm:top-[62%]" />
          <div className="pointer-events-none absolute right-[14%] top-[64%] z-10 h-3 w-3 rounded-full bg-green-bright animate-pulse sm:top-[66%]" />
          <div className="pointer-events-none absolute right-[8%] top-[58%] z-10 h-4 w-4 rounded-full bg-yellow-bright/90 animate-pulse sm:h-6 sm:w-6 sm:top-[56%] sm:right-[2%]" />
          <div className="pointer-events-none absolute left-[20%] top-[7%] z-10 h-5 w-5 rounded-full border-2 border-purple-medium/60 animate-pulse sm:left-[24%] sm:top-[12%] sm:h-10 sm:w-10" />
          <div className="pointer-events-none absolute right-[16%] top-[13%] z-10 h-5 w-5 rounded-full border-2 border-pink-bright/70 animate-pulse sm:right-[20%] sm:top-[18%] sm:h-10 sm:w-10" style={{ animationDelay: "0.5s" }} />

          <div className="pointer-events-none absolute left-[28%] top-[28%] z-10 h-2.5 w-2.5 rounded-full bg-pink-bright animate-bounce" />
          <div className="pointer-events-none absolute left-[44%] top-[70%] z-10 h-3 w-3 rounded-full bg-blue-bright animate-pulse sm:top-[68%]" />
          <div className="pointer-events-none absolute right-[26%] top-[28%] z-10 h-3 w-3 rounded-full bg-orange-bright animate-bounce" style={{ animationDelay: "0.2s" }} />
          <div className="pointer-events-none absolute right-[38%] top-[60%] z-10 h-6 w-6 rounded-full border-2 border-green-bright/70 animate-pulse sm:right-[36%] sm:top-[58%] sm:h-9 sm:w-9" style={{ animationDelay: "0.35s" }} />
          <div className="pointer-events-none absolute left-[36%] top-[19%] z-10 text-xs text-purple-medium/80 animate-pulse sm:left-[38%] sm:top-[22%] sm:text-lg">*</div>
          <div className="pointer-events-none absolute right-[30%] top-[73%] z-10 text-xs text-pink-bright/80 animate-bounce sm:right-[34%] sm:top-[70%] sm:text-base">+</div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
