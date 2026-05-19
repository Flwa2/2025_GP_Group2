import React, { useEffect } from "react";
import { createPortal } from "react-dom";

const getPortalTarget = () => {
  if (typeof document === "undefined") return null;
  return document.body && document.body.nodeType === 1 ? document.body : null;
};

const TYPE_STYLES = {
  success:
    "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border-emerald-800/50",
  error:
    "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-900/30 dark:text-rose-100 dark:border-rose-800/50",
  info: "bg-white text-black border-black/10 dark:bg-neutral-900 dark:text-white dark:border-white/10",
};

/**
 * Fixed viewport toast — always visible regardless of scroll position.
 */
export default function ViewportToast({
  message = "",
  type = "success",
  duration = 3000,
  onDismiss,
  position = "top-right",
}) {
  useEffect(() => {
    if (!message || !onDismiss) return undefined;
    const timer = setTimeout(() => onDismiss(), duration);
    return () => clearTimeout(timer);
  }, [message, duration, onDismiss]);

  if (!message) return null;

  const positionClass =
    position === "bottom-right"
      ? "bottom-5 right-5 sm:bottom-6 sm:right-6"
      : "top-5 right-5 sm:top-6 sm:right-6";

  const toast = (
    <div
      role="status"
      aria-live="polite"
      className={`fixed z-[10050] max-w-[min(92vw,22rem)] rounded-xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-sm ${positionClass} ${TYPE_STYLES[type] || TYPE_STYLES.info}`}
    >
      {message}
    </div>
  );

  const portalTarget = getPortalTarget();
  return portalTarget ? createPortal(toast, portalTarget) : toast;
}
