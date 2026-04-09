const DEFAULT_DEV_API_BASE_URL = "http://localhost:5000";

export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? DEFAULT_DEV_API_BASE_URL : "");
