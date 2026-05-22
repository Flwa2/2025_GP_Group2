/** Stable cache key for a voice catalog snapshot (length + first/last ids). */
export const catalogCacheKey = (voices) => {
  const list = voices || [];
  if (!list.length) return "0";
  const first = list[0]?.providerVoiceId || list[0]?.id || "";
  const last = list[list.length - 1]?.providerVoiceId || list[list.length - 1]?.id || "";
  return `${list.length}:${first}:${last}`;
};
