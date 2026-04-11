// src/components/AbstractArt.jsx
import React from 'react';

function AbstractArt() {
  return (
    <section className="bg-cream text-black transition-colors duration-500 dark:bg-[#0a0a1a] dark:text-white">
      <div className="relative h-64 w-full overflow-hidden md:h-80">
        <div className="pointer-events-none absolute inset-0 z-0">
          <img
            src="/img4.jpeg"
            alt="Abstract wallpaper"
            className="absolute inset-0 h-full w-full object-cover object-center opacity-90 dark:brightness-75"
          />

          <div
            className="absolute inset-0"
            style={{
              WebkitMaskImage: "linear-gradient(to top, black 78%, transparent 100%)",
              maskImage: "linear-gradient(to top, black 78%, transparent 100%)",
            }}
          />
        </div>

        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute left-[8%] top-[28%] h-24 w-24 rounded-full bg-pink-bright/35 blur-xl animate-pulse" />
          <div className="absolute right-[12%] top-[18%] h-28 w-28 rounded-full bg-blue-bright/30 blur-xl animate-pulse" />
          <div className="absolute bottom-[12%] left-[24%] h-20 w-20 rounded-full bg-yellow-bright/35 blur-lg animate-bounce" />
          <div className="absolute bottom-[16%] right-[20%] h-4 w-4 rounded-full bg-purple-medium animate-bounce" />
          <div className="absolute left-[42%] top-[40%] text-xl text-black/75 dark:text-white/80 animate-pulse">✦</div>
          <div className="absolute left-[55%] top-[62%] text-base text-black/65 dark:text-white/70 animate-pulse" style={{ animationDelay: "0.5s" }}>✧</div>
        </div>
      </div>
    </section>
  );
}

export default AbstractArt;
