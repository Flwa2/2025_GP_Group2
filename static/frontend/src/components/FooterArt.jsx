import React, { useState } from "react";
import { useTranslation } from "react-i18next";

function FooterArt() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const onSubmit = (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;

    const subject = encodeURIComponent("WeCast Contact Request");
    const body = encodeURIComponent(`Contact email: ${value}`);
    window.location.href = `mailto:WeCast@gmail.com?subject=${subject}&body=${body}`;

    setSent(true);
    setEmail("");
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <section className="relative overflow-hidden bg-[#f2cc59] text-black transition-colors duration-500 dark:bg-[#6d541f] dark:text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-10 right-0 h-36 w-64 rounded-bl-[90px] bg-pink-bright/35" />
        <div className="absolute left-6 top-28 h-6 w-6 rounded-full bg-purple-medium/70" />
        <div className="absolute left-12 top-40 h-5 w-5 rounded-full bg-purple-medium/70" />
        <div className="absolute left-9 top-52 h-7 w-7 rounded-full bg-purple-medium/70" />
      </div>

      <div className="section-shell section-block relative max-w-5xl py-14 text-center max-sm:py-12 sm:py-20">
        <h3 className="heading-lg mx-auto max-w-[min(100%,22rem)] text-balance sm:max-w-none">
          {t("contact.title")}
        </h3>
        <p className="body-md mx-auto mt-5 max-w-3xl px-0 text-black/65 max-sm:mt-5 max-sm:px-1 max-sm:leading-6 dark:text-white/70">
          {t("contact.description")}
        </p>

        <form
          onSubmit={onSubmit}
          className="mx-auto mt-8 flex w-full max-w-3xl min-w-0 flex-col gap-3.5 max-sm:mt-7 max-sm:max-w-md sm:flex-row sm:items-stretch sm:gap-3"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("contact.emailPlaceholder")}
            className="min-h-[52px] w-full min-w-0 flex-1 rounded-2xl border border-black/20 bg-[#f6f1e3] px-4 py-3.5 text-base text-neutral-900 caret-neutral-900 outline-none placeholder:text-black/45 focus:border-black/45 max-sm:min-h-[54px] max-sm:px-[1.125rem] max-sm:py-3.5 sm:h-12 sm:min-h-0 sm:rounded-xl sm:py-2 sm:leading-normal dark:text-neutral-900 dark:caret-neutral-900"
          />
          <button
            type="submit"
            className="btn-primary h-auto min-h-[52px] w-full shrink-0 justify-center rounded-2xl px-6 py-3.5 max-sm:min-h-[54px] sm:h-11 sm:min-h-0 sm:w-auto sm:rounded-xl sm:py-0"
          >
            {t("contact.button")}
          </button>
        </form>

        {sent && (
          <p className="body-sm mt-4 font-medium text-black/70 max-sm:mt-5 dark:text-white/80">
            {t("contact.openingMail")}
          </p>
        )}
      </div>
    </section>
  );
}

export default FooterArt;
