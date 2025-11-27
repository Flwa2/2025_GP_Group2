// src/components/Header.jsx
import { useEffect, useState } from "react";
import CurvedWeCast from "./CurvedWeCast";

export default function Header() {
  const [loggedIn, setLoggedIn] = useState(false);

  const goEpisodes = (e) => {
    e.preventDefault();
    // always land on home then smooth-scroll to #episodes
    window.location.hash = "#/";
    setTimeout(() => {
      const el = document.querySelector("#episodes");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  useEffect(() => {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    setLoggedIn(!!token);

    const handleStorage = (e) => {
      if (e.key === "token") {
        setLoggedIn(!!e.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const scrollToTop = () => {
    window.location.hash = "#/";
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/20 dark:bg-black/40 backdrop-blur-md border-b border-black/10 dark:border-white/10 text-black dark:text-white">
      <nav className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* LEFT: logo + animated WeCast */}
        <div className="flex items-center gap-2">
          <button onClick={scrollToTop}>
            <img
              src="/logo.png"
              alt="WeCast logo"
              className="w-8 h-8 object-contain"
            />
          </button>
          <button onClick={scrollToTop} className="corner-logo block">
            <strong className="text-3xl md:text-2xl font-black tracking-wide text-black dark:text-white">
              WeCast
            </strong>
          </button>

        </div>

        {/* CENTER: navigation links */}
        <ul className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6 text-base">
          <li>
            <button
              onClick={scrollToTop}
              className="transition-colors duration-300 hover:text-purple-600"
            >
              Home
            </button>

          </li>

          {/* Profile only when logged in */}
          {loggedIn && (
            <li>
              <a
                href="#/account"
                className="transition-colors duration-300 hover:text-purple-600"
              >
                Profile
              </a>
            </li>
          )}
        </ul>

        {/* RIGHT: auth buttons */}
        <div className="flex items-center gap-3">
          {!loggedIn && (
            <>
              <a
                href="#/login"
                className="px-3 py-1.5 rounded-lg text-black dark:text-gray-100 font-normal transition-all duration-300 hover:font-semibold hover:underline underline-offset-4"
                style={{ backgroundColor: "transparent", border: "none" }}
              >
                Log in
              </a>

              <a
                href="#/signup"
                className="px-3 py-1.5 rounded-lg bg-black text-white font-bold border-2 border-black transition-all duration-300 hover:bg-pink-200 hover:text-black"
              >
                Sign Up
              </a>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
