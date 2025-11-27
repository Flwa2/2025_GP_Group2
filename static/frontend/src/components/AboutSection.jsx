// src/components/AboutSection.jsx 
import React from 'react';

export default function AboutSection() {
  return (
    <section id="about" className="section relative overflow-hidden py-20
                        bg-cream dark:bg-[#0a0a1a]
                        text-neutral-900 dark:text-gray-100
                        transition-colors duration-500">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center px-6">

        {/* LEFT — ABOUT WECAST */}
        <div className="space-y-6 z-10 relative lg:ml-16 md:ml-10">
          <h2 className="text-5xl font-extrabold tracking-wide">
            About <span className="text-black dark:text-gray-100 font-extrabold curved-wecast">WeCast</span>
          </h2>

          <p className="text-lg leading-relaxed max-w-lg
                        text-neutral-800 dark:text-gray-300">
            <strong className="font-semibold text-neutral-900 dark:text-white">WeCast</strong> transforms your words into a voice that connects,
            teaches, and inspires. With just one click, your written content becomes a lively podcast conversation—
            clear, expressive, and full of personality.
          </p>

          <p className="text-lg leading-relaxed max-w-lg
                        text-neutral-800 dark:text-gray-300">
            Built for creators, educators, and dreamers, WeCast bridges storytelling and sound,
            making every article feel like a real dialogue your audience can hear and enjoy.
          </p>

          <p className="text-lg leading-relaxed max-w-lg italic
                        text-neutral-700 dark:text-gray-400">
            "From written ideas to real conversations, <strong className="font-semibold text-neutral-900 dark:text-white">WeCast</strong> brings your content to life.”
          </p>
        </div>

        {/* RIGHT — MIC & DECOR */}
        <div className="relative h-[500px]">
          {/* Background glow */}
          <div className="absolute right-0 top-20 w-64 h-64 bg-pink-bright rounded-full blur-3xl opacity-30 animate-pulse"></div>
          <div className="absolute right-10 bottom-10 w-40 h-40 bg-yellow-bright rounded-full blur-2xl opacity-30 animate-bounce"></div>

          {/* MIC IMAGE */}
          <img
            src="/img2.png"
            alt="WeCast microphone"
            className="absolute bottom-[10px] right-[-80px] w-[420px] -rotate-[30deg] drop-shadow-2xl opacity-95 select-none pointer-events-none"
          />

          {/* Floating icons */}
          <div className="absolute top-20 right-80 text-yellow-bright text-3xl animate-bounce">★</div>
          <div className="absolute top-12 right-40 text-pink-bright text-2xl animate-spin-slow">♫</div>
          <div className="absolute top-16 right-20 text-black dark:text-white text-3xl animate-float">♪</div>
          <div className="absolute bottom-6 right-64 text-green-bright text-2xl animate-bounce-slow">✦</div>
          <div className="absolute top-1/3 right-20 text-yellow-bright text-3xl animate-pulse">✺</div>
        </div>
      </div>

      {/* Soft overlay for depth */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-800/40 via-transparent to-pink-500/20"></div>
    </section>
  );
}
