import React from "react";
import { useTranslation } from "react-i18next";
import {
  Instagram,
  Linkedin,
  Podcast,
  Radio,
  Twitter,
  Youtube,
} from "lucide-react";

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

  const quickLinks = [
    { label: "Home", color: "bg-[#ef4444]", onClick: scrollToTop, type: "button" },
    { label: "Cast Studio", color: "bg-[#22c55e]", href: "#/episodes", type: "link" },
    {
      label: "About Us",
      color: "bg-[#3b82f6]",
      href: "#about",
      type: "anchor",
      onClick: (e) => {
        e.preventDefault();
        navigateToSection("#about");
      },
    },
    { label: "Create Script", color: "bg-[#f59e0b]", href: "#/create", type: "link" },
  ];

  const socialLinks = [
    { label: "Spotify", href: "https://open.spotify.com/", icon: Podcast },
    { label: "Apple Podcasts", href: "https://podcasts.apple.com/", icon: Radio },
    { label: "YouTube", href: "https://www.youtube.com/", icon: Youtube },
    { label: "X / Twitter", href: "https://x.com/", icon: Twitter },
    { label: "Instagram", href: "https://www.instagram.com/", icon: Instagram },
    { label: "LinkedIn", href: "https://www.linkedin.com/", icon: Linkedin },
  ];

  return (
    <footer className="min-w-0 shrink-0 bg-[#f9e7c4] text-[#2c2217] transition-colors duration-500 dark:bg-[linear-gradient(145deg,#070910_0%,#0c1222_52%,#1c1540_100%)] dark:text-white">
      <div className="h-1.5 w-full bg-[#e6c34a] dark:bg-purple-gradient" />

      <div className="section-shell pt-12 pb-7 md:pt-14 md:pb-9">
        <div className="grid min-w-0 grid-cols-1 gap-y-7 text-center md:text-start lg:mx-auto lg:max-w-6xl lg:grid-cols-12 lg:gap-x-5 lg:gap-y-8">
          <section className="min-w-0 order-1 lg:col-span-5">
            <div className="flex items-center justify-center gap-3.5 md:justify-start">
              <img
                src="/logo.png"
                alt="WeCast logo"
                className="h-12 w-12 shrink-0 object-contain dark:brightness-110 dark:contrast-110 dark:[filter:drop-shadow(0_0_10px_rgba(139,92,246,0.55))]"
              />
              <h4
                className="text-3xl font-semibold leading-none tracking-tight text-[#2c2217] dark:text-white"
                style={{ fontFamily: "\"Playfair Display\", \"Cormorant Garamond\", Georgia, serif" }}
              >
                WeCast
              </h4>
            </div>
            <p className="mx-auto mt-3.5 max-w-[35ch] text-sm leading-6 text-[#3f3428]/80 dark:text-[#b8b8c7] md:mx-0">
              Turn your ideas into polished podcast episodes with voice, script, and preview in one flow.
            </p>
            <p className="mt-2.5 text-sm font-semibold text-purple-700 dark:text-purple-300">
              Built for creators. Powered by AI.
            </p>

          </section>

          <section className="min-w-0 order-3 lg:order-2 lg:col-span-4 lg:ps-4">
            <h5 className="text-base font-semibold text-[#2c2217] dark:text-white">{t("footer.quickLinks")}</h5>
            <ul className="mt-4 flex min-w-0 flex-wrap items-center justify-center gap-x-7 gap-y-3 md:justify-start lg:flex-col lg:items-start lg:gap-x-0 lg:gap-y-1">
              {quickLinks.map((item) => (
                <li key={item.label} className="min-w-0">
                  {item.type === "button" ? (
                    <button
                      onClick={item.onClick}
                      className="group inline-flex min-h-10 items-center gap-2.5 text-sm font-medium text-[#2f2419]/90 transition hover:text-purple-700 dark:text-[#e6e6f0] dark:hover:text-purple-300"
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.color}`} />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </button>
                  ) : (
                    <a
                      href={item.href}
                      onClick={item.onClick}
                      className="group inline-flex min-h-10 items-center gap-2.5 text-sm font-medium text-[#2f2419]/90 transition hover:text-purple-700 dark:text-[#e6e6f0] dark:hover:text-purple-300"
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.color}`} />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="min-w-0 order-2 lg:order-3 lg:col-span-3 lg:ps-2 lg:text-start">
            <h5 className="text-base font-semibold text-[#2c2217] dark:text-white">Follow Us</h5>
            <ul className="mt-2.5 flex min-w-0 flex-wrap items-center justify-center gap-3.5 md:justify-start lg:flex-nowrap lg:justify-start lg:gap-1.5">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    title={label}
                    className="inline-flex h-10 w-10 items-center justify-center text-[#3f3428]/85 transition hover:text-purple-700 dark:text-[#b8b8c7] dark:hover:text-purple-300"
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-8">
          <div className="mx-auto h-px w-full max-w-[94%] bg-black/20 dark:bg-gradient-to-r dark:from-transparent dark:via-white/20 dark:to-transparent" />
          <p className="mt-4 text-center text-sm text-black/60 dark:text-[#9d9dad]">
            © 2026 WeCast. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
