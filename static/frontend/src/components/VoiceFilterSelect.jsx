import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";

const optionText = (label) => {
  if (typeof label === "string" || typeof label === "number") return String(label);
  return "";
};

const EDGE_PADDING = 8;
const MENU_GAP = 6;
const MIN_MENU_HEIGHT = 96;

const getClampBounds = (triggerEl) => {
  if (typeof window === "undefined") return null;

  const dialog = triggerEl?.closest?.('[role="dialog"]');
  const panel = dialog?.firstElementChild;
  const panelRect = panel?.getBoundingClientRect?.();

  if (panelRect) {
    return {
      top: panelRect.top + EDGE_PADDING,
      bottom: panelRect.bottom - EDGE_PADDING,
      left: panelRect.left + EDGE_PADDING,
      right: panelRect.right - EDGE_PADDING,
    };
  }

  return {
    top: EDGE_PADDING,
    bottom: window.innerHeight - EDGE_PADDING,
    left: EDGE_PADDING,
    right: window.innerWidth - EDGE_PADDING,
  };
};

const computeMenuStyle = (triggerEl, preferredMaxHeight) => {
  const rect = triggerEl?.getBoundingClientRect?.();
  const bounds = getClampBounds(triggerEl);
  if (!rect || !bounds) return null;

  const fieldWidth = rect.width;
  const maxAllowedWidth = bounds.right - bounds.left;
  const width = Math.min(fieldWidth, maxAllowedWidth);

  let left = rect.left;
  if (left + width > bounds.right) left = bounds.right - width;
  if (left < bounds.left) left = bounds.left;

  const spaceBelow = bounds.bottom - rect.bottom - MENU_GAP;
  const spaceAbove = rect.top - bounds.top - MENU_GAP;
  const openUp = spaceBelow < MIN_MENU_HEIGHT && spaceAbove > spaceBelow;
  const availableSpace = Math.max(MIN_MENU_HEIGHT, openUp ? spaceAbove : spaceBelow);
  const maxHeight = Math.min(preferredMaxHeight, availableSpace);

  let top = openUp ? rect.top - MENU_GAP - maxHeight : rect.bottom + MENU_GAP;
  if (openUp) {
    top = Math.max(bounds.top, top);
  } else {
    top = Math.min(top, bounds.bottom - maxHeight);
    top = Math.max(bounds.top, top);
  }

  return {
    position: "fixed",
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    minWidth: `${width}px`,
    maxWidth: `${width}px`,
    maxHeight: `${maxHeight}px`,
    zIndex: 10080,
  };
};

export default function VoiceFilterSelect({
  value = "",
  options = [],
  placeholder = "Select",
  onChange,
  disabled = false,
  isRTL = false,
  menuVariant = "default",
  menuSize = "default",
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const toneMenu = menuVariant === "tone";
  const compactMenu = menuSize === "compact";
  const preferredMaxHeight = compactMenu ? 160 : 224;

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

  const updateMenuPosition = useCallback(() => {
    if (!open) return;
    const nextStyle = computeMenuStyle(rootRef.current, preferredMaxHeight);
    if (nextStyle) setMenuStyle(nextStyle);
  }, [open, preferredMaxHeight]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return undefined;
    }
    updateMenuPosition();
    return undefined;
  }, [open, updateMenuPosition, normalizedOptions.length]);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const handleToggle = () => {
    if (disabled) return;
    setOpen((wasOpen) => {
      const nextOpen = !wasOpen;
      if (nextOpen) {
        const nextStyle = computeMenuStyle(rootRef.current, preferredMaxHeight);
        if (nextStyle) setMenuStyle(nextStyle);
      }
      return nextOpen;
    });
  };

  const menu =
    open && menuStyle ? (
      <div
        ref={menuRef}
        role="listbox"
        style={menuStyle}
        className={[
          "box-border overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border p-1.5 shadow-xl",
          toneMenu
            ? "border-neutral-200 bg-white text-neutral-900 [scrollbar-color:rgba(139,92,246,0.55)_rgba(17,17,29,0.95)] [scrollbar-width:thin] dark:border-white/10 dark:bg-[#11111d] dark:text-neutral-100 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-purple-500/50 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-[#11111d]"
            : "border-neutral-200 bg-white dark:border-white/10 dark:bg-neutral-950",
        ].join(" ")}
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
                "flex w-full min-w-0 max-w-full items-center rounded-lg px-3 py-2 text-start text-sm leading-5 transition",
                toneMenu
                  ? selected
                    ? "bg-purple-50 font-semibold text-purple-700 dark:bg-purple-600/35 dark:text-white"
                    : "text-neutral-800 hover:bg-black/5 hover:text-neutral-950 dark:text-neutral-200 dark:hover:bg-white/10 dark:hover:text-white"
                  : selected
                    ? "bg-purple-50 font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-200"
                    : "hover:bg-black/5 dark:hover:bg-white/10",
              ].join(" ")}
            >
              <span className="block min-w-0 max-w-full truncate">{option.label}</span>
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={handleToggle}
        className={[
          "form-input !h-10 !min-h-10 !px-3 !py-0 flex w-full min-w-0 items-center justify-between gap-2 text-start text-sm font-normal leading-5",
          isRTL ? "pl-10 pr-3" : "pl-3 pr-10",
          disabled ? "cursor-not-allowed opacity-60" : "",
        ].join(" ")}
      >
        <span className="flex min-w-0 flex-1 items-center truncate text-sm font-normal leading-5 text-neutral-900 dark:text-neutral-100 [&_*]:text-sm [&_*]:leading-5">
          {selectedLabel}
        </span>
      </button>
      <ChevronDown
        className={[
          "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-black/50 transition dark:text-white/60",
          open ? "rotate-180" : "",
          isRTL ? "left-3" : "right-3",
        ].join(" ")}
      />

      {menu && typeof document !== "undefined" && document.body
        ? createPortal(menu, document.body)
        : null}
    </div>
  );
}
