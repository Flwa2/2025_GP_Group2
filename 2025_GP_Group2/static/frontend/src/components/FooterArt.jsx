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

      <div className="section-shell section-block relative max-w-5xl py-14 text-center sm:py-20">
        <h3 className="heading-lg max-w-[10ch] mx-auto sm:max-w-none">
          {t("contact.title")}
        </h3>
        <p className="body-md mx-auto mt-5 max-w-3xl text-black/65 dark:text-white/70">
          {t("contact.description")}
        </p>

        <form
          onSubmit={onSubmit}
          className="mx-auto mt-8 flex w-full max-w-3xl flex-col gap-3 sm:flex-row sm:items-center"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("contact.emailPlaceholder")}
            className="h-12 w-full flex-1 rounded-xl border border-black/20 bg-[#f6f1e3] px-4 text-base text-neutral-900 caret-neutral-900 outline-none placeholder:text-black/45 focus:border-black/45 dark:text-neutral-900 dark:caret-neutral-900"
          />
          <button
            type="submit"
            className="btn-primary w-full justify-center px-6 sm:w-auto"
          >
            {t("contact.button")}
          </button>
        </form>

        {sent && (
          <p className="body-sm mt-3 font-medium text-black/70 dark:text-white/80">
            {t("contact.openingMail")}
          </p>
        )}
      </div>
    </section>
  );
}

export default FooterArt;
