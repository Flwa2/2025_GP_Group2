import React, { useEffect } from "react";

export default function Modal({ open, title, onClose, children, footer, isRTL }) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-[560px] rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-neutral-200/70 dark:border-neutral-800/70">
          <h3 className="font-extrabold text-black dark:text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 grid place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-5">{children}</div>

        {footer ? (
          <div className="px-5 py-4 border-t border-neutral-200/70 dark:border-neutral-800/70 flex items-center justify-end gap-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
