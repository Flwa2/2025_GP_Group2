import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BACKEND_API_BASE_URL = "https://wecast.onrender.com";
const STATIC_SITE_HOSTS = ["wecastsa.com", "www.wecastsa.com"];

function resolveBuildApiBaseUrl(mode) {
  const configured = String(process.env.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");
  if (mode !== "production") {
    return configured;
  }
  if (!configured) {
    return BACKEND_API_BASE_URL;
  }
  try {
    const host = new URL(configured).hostname.toLowerCase();
    if (STATIC_SITE_HOSTS.includes(host)) {
      console.warn(
        `[WeCast build] VITE_API_BASE_URL must not be the public site (${configured}). ` +
          `Using backend ${BACKEND_API_BASE_URL} instead.`
      );
      return BACKEND_API_BASE_URL;
    }
  } catch {
    return BACKEND_API_BASE_URL;
  }
  return configured;
}

export default defineConfig(({ mode }) => {
  const apiBaseUrl = resolveBuildApiBaseUrl(mode);

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify(apiBaseUrl),
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:5000",
          changeOrigin: true,
        },
      },
    },
  };
});
