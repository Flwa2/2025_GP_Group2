// src/components/Header.jsx
import CurvedWeCast from "./CurvedWeCast";

export default function Header() {
  const goEpisodes = (e) => {
    e.preventDefault();
    // always land on home then smooth-scroll to #episodes
    window.location.hash = "#/";
    setTimeout(() => {
      const el = document.querySelector("#episodes");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/20 dark:bg-black/40 backdrop-blur-md border-b border-black/10 dark:border-white/10 text-black dark:text-white">
      <nav className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* LEFT: logo + animated WeCast */}
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="WeCast logo"
            className="w-8 h-8 object-contain"
          />
          <a href="#/" className="corner-logo block" aria-label="WeCast Home">
            <strong className="text-3xl md:text-2xl font-black tracking-wide text-black dark:text-white">
              WeCast
            </strong>
          </a>
        </div>

        {/* CENTER: navigation links */}
        <ul className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6 text-base">
          <li>
            <a
              href="#/"
              className="transition-colors duration-300 hover:text-purple-600"
            >
              Home
            </a>
          </li>
          <li>
            <a
              href="#/episodes"
              onClick={goEpisodes}
              className="transition-colors duration-300 hover:text-purple-600"
            >
              Episodes
            </a>
          </li>
          <li>
            <a
              href="#/account"
              className="transition-colors duration-300 hover:text-purple-600"
            >
              Profile
            </a>
          </li>
        </ul>

        <div className="flex items-center gap-3">
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

        </div>
      </nav>
    </header>
  );
}
