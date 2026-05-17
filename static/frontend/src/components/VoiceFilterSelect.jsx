import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const optionText = (label) => {
  if (typeof label === "string" || typeof label === "number") return String(label);
  return "";
};

export default function VoiceFilterSelect({
  value = "",
  options = [],
  placeholder = "Select",
  onChange,
  disabled = false,
  isRTL = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const normalizedOptions = useMemo(
    () =>
      options.map((option) =>
        typeof option === "string"
          ? { value: option, label: option }
          : { value: option.value ?? "", label: option.label ?? option.value ?? "" }
      ),
    [options]
  );

  const selectedOption = normalizedOptions.find((option) => String(option.value) === String(value));
  const selectedLabel = selectedOption?.label ?? placeholder;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((next) => !next)}
        className={[
          "form-input !px-3 !py-2 flex min-h-10 w-full items-center justify-between gap-2 pr-10 text-start text-sm",
          disabled ? "cursor-not-allowed opacity-60" : "",
        ].join(" ")}
      >
        <span className="min-w-0 truncate">{selectedLabel}</span>
      </button>
      <ChevronDown
        className={[
          "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-black/50 transition dark:text-white/60",
          open ? "rotate-180" : "",
          isRTL ? "left-3" : "right-3",
        ].join(" ")}
      />

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-[10040] max-h-56 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-neutral-950"
        >
          {normalizedOptions.map((option) => {
            const selected = String(option.value) === String(value);
            return (
              <button
                key={`${option.value}-${optionText(option.label)}`}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange?.(option.value);
                  setOpen(false);
                }}
                className={[
                  "flex w-full items-center rounded-lg px-3 py-2 text-start text-sm transition",
                  selected
                    ? "bg-purple-50 font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-200"
                    : "hover:bg-black/5 dark:hover:bg-white/10",
                ].join(" ")}
              >
                <span className="min-w-0 truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
