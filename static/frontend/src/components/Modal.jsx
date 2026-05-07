import React, { useEffect, useId } from "react";
import { createPortal } from "react-dom";

const getPortalTarget = () => {
  if (typeof document === "undefined") return null;
  return document.body && document.body.nodeType === 1 ? document.body : null;
};

export default function Modal({ open, title, onClose, children, footer, isRTL, dense = false }) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    if (typeof document === "undefined" || !document.body) return;

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

  const overlay = (
    <div
      className="wecast-overlay grid place-items-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="flex w-[min(92vw,560px)] max-h-[min(90dvh,90vh)] min-w-0 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-black/30"
        onClick={(e) => e.stopPropagation()}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div
          className={`flex shrink-0 items-center justify-between border-b border-neutral-200/70 dark:border-neutral-800/70 ${
            dense ? "gap-2 px-4 py-3" : "gap-3 px-5 py-4"
          }`}
        >
          <h3 id={titleId} className="min-w-0 font-extrabold text-black dark:text-white">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl transition hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div
          className={`min-h-0 flex-auto overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:thin] ${
            dense ? "px-4 py-3 sm:py-3" : "px-5 py-4 sm:py-5"
          }`}
        >
          {children}
        </div>

        {footer ? (
          <div
            className={`flex shrink-0 items-center justify-end border-t border-neutral-200/70 dark:border-neutral-800/70 ${
              dense ? "gap-2 px-4 py-3" : "gap-3 px-5 py-4"
            }`}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );

  const portalTarget = getPortalTarget();
  return portalTarget ? createPortal(overlay, portalTarget) : overlay;
}
