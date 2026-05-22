import { VOICE_AGE_BUCKETS } from "./voiceAgeFilters";
import { ARABIC_ACCENT_ALIASES, ENGLISH_ACCENT_OPTIONS } from "./voiceAccentFilters";
import { invalidateVoiceFilterComputeCache } from "./voiceFilterComputeCache";

const CACHE_STORAGE_KEY = "wecast:voiceCatalog:v4";
const CACHE_TTL_MS = 30 * 60 * 1000;

let memoryCatalog = null;
let loadPromise = null;

const getVoiceId = (voice, index = 0) =>
  voice?.providerVoiceId || voice?.id || voice?.docId || `voice-${index}`;

export const mergeVoicesById = (...voiceLists) => {
  const out = new Map();
  voiceLists.flat().filter(Boolean).forEach((voice, idx) => {
    const id = getVoiceId(voice, idx);
    if (!out.has(id)) out.set(id, voice);
  });
  return Array.from(out.values());
};

function readStorageCache() {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.t !== "number" || !Array.isArray(parsed.items)) return null;
    if (Date.now() - parsed.t > CACHE_TTL_MS) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

function writeStorageCache(items) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify({ t: Date.now(), items }));
  } catch {
    /* quota */
  }
}

export function getCachedVoiceCatalog() {
  return memoryCatalog;
}

export function clearVoiceLibraryCache() {
  memoryCatalog = null;
  loadPromise = null;
  invalidateVoiceFilterComputeCache();
  try {
    sessionStorage.removeItem(CACHE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

async function expandCatalogWithAgeBuckets(fetchPage, baseApplied = {}) {
  if (!fetchPage) return [];
  const base = await fetchPage({ ...baseApplied, age: "" }, 0, 100);
  const baseItems = Array.isArray(base?.items) ? base.items : Array.isArray(base) ? base : [];
  const ageResults = await Promise.allSettled(
    VOICE_AGE_BUCKETS.map((age) => fetchPage({ ...baseApplied, age }, 0, 100))
  );
  const agePages = ageResults
    .filter((result) => result.status === "fulfilled")
    .map((result) => {
      const value = result.value;
      return Array.isArray(value?.items) ? value.items : Array.isArray(value) ? value : [];
    });
  return mergeVoicesById(baseItems, ...agePages);
}

async function fetchAllPagesForFilters(fetchPage, applied, maxPages = 8) {
  const pages = [];
  for (let page = 0; page < maxPages; page += 1) {
    const result = await fetchPage(applied, page, 100);
    const items = Array.isArray(result?.items) ? result.items : Array.isArray(result) ? result : [];
    pages.push(items);
    const hasMore = Boolean(result?.has_more ?? result?.hasMore);
    if (!hasMore || items.length === 0) break;
  }
  return mergeVoicesById(...pages);
}

async function expandCatalogWithLanguageAccentBuckets(fetchPage) {
  if (!fetchPage) return [];
  const arabicAccentRequests = ARABIC_ACCENT_ALIASES.flatMap((alias) =>
    Array.from(new Set([alias.display, ...(alias.keywords || [])]))
      .filter(Boolean)
      .map((accent) => ({ language: "ar", accent }))
  );
  const accentRequests = [
    { language: "ar" },
    { language: "en" },
    ...arabicAccentRequests,
    ...ENGLISH_ACCENT_OPTIONS.map((accent) => ({ language: "en", accent })),
  ];
  const results = await Promise.allSettled(
    accentRequests.map((applied) => fetchAllPagesForFilters(fetchPage, applied))
  );
  return mergeVoicesById(
    ...results
      .filter((result) => result.status === "fulfilled")
      .map((result) => {
        const value = result.value;
        return Array.isArray(value?.items) ? value.items : Array.isArray(value) ? value : [];
      })
  );
}

/**
 * Load the shared voice catalog once per session (memory + sessionStorage).
 * @param {object} loaders
 * @param {() => Promise<{items: Array}>} loaders.fetchSeedPage - single ElevenLabs page (e.g. page 0, size 100)
 * @param {(applied: object) => Promise<{items: Array}|Array>} [loaders.fetchPageForAgeBuckets] - optional; merges age-bucket pages once
 * @param {() => Promise<Array>} [loaders.fetchAccountVoices]
 * @param {() => Promise<Array>} [loaders.fetchFallbackVoices]
 */
export async function ensureVoiceLibraryCatalog(loaders) {
  if (memoryCatalog?.length) return memoryCatalog;

  const stored = readStorageCache();
  if (stored?.length) {
    invalidateVoiceFilterComputeCache();
    memoryCatalog = stored;
    return memoryCatalog;
  }

  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      let seedItems = [];
      if (loaders.fetchPageForAgeBuckets) {
        const [ageBucketItems, languageAccentItems] = await Promise.all([
          expandCatalogWithAgeBuckets(loaders.fetchPageForAgeBuckets, {}),
          expandCatalogWithLanguageAccentBuckets(loaders.fetchPageForAgeBuckets),
        ]);
        seedItems = mergeVoicesById(ageBucketItems, languageAccentItems);
      } else {
        const seedPage = await loaders.fetchSeedPage();
        seedItems = Array.isArray(seedPage?.items) ? seedPage.items : [];
      }
      let accountItems = [];
      if (loaders.fetchAccountVoices) {
        try {
          accountItems = await loaders.fetchAccountVoices();
        } catch {
          accountItems = [];
        }
      }
      const merged = mergeVoicesById(seedItems, accountItems);
      if (merged.length) {
        invalidateVoiceFilterComputeCache();
        memoryCatalog = merged;
        writeStorageCache(merged);
        return merged;
      }
      throw new Error("Empty voice catalog");
    } catch (primaryError) {
      if (loaders.fetchFallbackVoices) {
        try {
          const fallback = await loaders.fetchFallbackVoices();
          memoryCatalog = Array.isArray(fallback) ? fallback : [];
          if (memoryCatalog.length) {
            invalidateVoiceFilterComputeCache();
            writeStorageCache(memoryCatalog);
          }
          return memoryCatalog;
        } catch {
          /* fall through */
        }
      }
      console.error("[WeCast] voice catalog load failed", primaryError);
      memoryCatalog = [];
      return memoryCatalog;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}
