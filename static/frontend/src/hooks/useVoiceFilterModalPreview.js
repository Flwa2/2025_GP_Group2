import { useEffect, useMemo, useState } from "react";
import { filtersModalToApplied } from "../utils/voiceFilterModal";

const PREVIEW_DEBOUNCE_MS = 400;

/**
 * Debounced live voice count for the filters modal (Create + Edit).
 * @param {object} options
 * @param {boolean} options.enabled - When false, preview is cleared.
 * @param {object} options.filters - Modal filter state (q, gender, language, …).
 * @param {() => number|Promise<number>} options.getCount - Returns matching voice count for current filters.
 */
export function useVoiceFilterModalPreview({ enabled, filters, getCount }) {
  const [preview, setPreview] = useState({ loading: false, refinedCount: null });

  const draftKey = useMemo(
    () => JSON.stringify(filtersModalToApplied(filters || {})),
    [filters]
  );

  useEffect(() => {
    if (!enabled || typeof getCount !== "function") {
      setPreview({ loading: false, refinedCount: null });
      return undefined;
    }

    setPreview((prev) => ({ ...prev, loading: true }));
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const count = await Promise.resolve(getCount());
        if (!cancelled) {
          setPreview({
            loading: false,
            refinedCount: typeof count === "number" ? count : null,
          });
        }
      } catch {
        if (!cancelled) {
          setPreview({ loading: false, refinedCount: null });
        }
      }
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, draftKey, getCount]);

  return preview;
}
