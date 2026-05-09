const DEFAULT_DEV_API_BASE_URL = "http://localhost:5000";
/** When VITE_API_BASE_URL is missing from the production build, relative /api/* hits the static host (broken). */
const DEFAULT_PROD_API_BASE_URL = "https://wecast.onrender.com";

export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? DEFAULT_DEV_API_BASE_URL : DEFAULT_PROD_API_BASE_URL);
