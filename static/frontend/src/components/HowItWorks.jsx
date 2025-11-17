// src/components/HowItWorks.jsx
import React from "react";
import StepCard from "./StepCard";

export default function HowItWorks() {
  return (
    <section className="bg-[#cfc2ff] dark:bg-[#0a0a1a] text-black dark:text-white pt-20 pb-20 md:pb-16 transition-colors duration-500">
      <div className="relative max-w-6xl mx-auto">
        <h2 className="text-4xl font-extrabold tracking-wide text-black text-center dark:text-gray-100">
          How WeCast Works
        </h2>

        <p className="mt-3 text-center text-black/70 dark:text-gray-300 max-w-2xl mx-auto">
          Turn your text into a podcast in a few guided steps<br />
          no setup, no mic, no editing.
        </p>

        {/* keep original spacing */}
        {/* 3-step overview */}
        <ol className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          
          {/* Step 1 */}
          <StepCard
            delay={0}
            className="group relative rounded-2xl p-6
                      bg-white/70 dark:bg-[#12121f]/85 backdrop-blur
                      border border-black/10 dark:border-white/10
                      hover:border-black/20 dark:hover:border-white/20
                      transition-all duration-300"
          >
            <div className="absolute -top-3 -left-3 h-10 w-10 rounded-full
                            grid place-items-center font-bold
                            bg-black text-white dark:bg-white dark:text-black">
              1
            </div>

            <h3 className="text-2xl font-semibold mb-3 text-black dark:text-white">
              Choose Style & Speakers
            </h3>

            <p className="text-black/80 dark:text-gray-300">
              Pick how you want your podcast to sound, then choose the number of speakers and their voices.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              {["Interview", "Educational", "Storytelling", "Conversational"].map((style, i) => (
                <span
                  key={i}
                  className="inline-block rounded-full px-4 py-1.5 text-sm font-medium
                            bg-gradient-to-r from-purple-600 to-pink-500 text-white
                            transition-all duration-300 transform
                            hover:scale-105 hover:from-pink-500 hover:to-purple-600
                            cursor-default select-none"
                >
                  {style}
                </span>
              ))}
            </div>
          </StepCard>

          {/* Step 2 */}
          <StepCard
            delay={150}
            className="group relative rounded-2xl p-6
                      bg-white/70 dark:bg-[#12121f]/85 backdrop-blur
                      border border-black/10 dark:border-white/10
                      hover:border-black/20 dark:hover:border-white/20
                      transition-all duration-300"
          >
            <div className="absolute -top-3 -left-3 h-10 w-10 rounded-full
                            grid place-items-center font-bold
                            bg-black text-white dark:bg-white dark:text-black">
              2
            </div>

            <h3 className="text-2xl font-semibold mb-3 text-black dark:text-white">
              Write & Refine Your Content
            </h3>

            <p className="text-black/80 dark:text-gray-300">
              Paste your text and let WeCast turn it into a structured podcast script. 
              Review it, make edits, and shape it the way you want.
            </p>
          </StepCard>

          {/* Step 3 */}
          <StepCard
            delay={300}
            className="group relative rounded-2xl p-6
                      bg-white/70 dark:bg-[#12121f]/85 backdrop-blur
                      border border-black/10 dark:border-white/10
                      hover:border-black/20 dark:hover:border-white/20
                      transition-all duration-300"
          >
            <div className="absolute -top-3 -left-3 h-10 w-10 rounded-full
                            grid place-items-center font-bold
                            bg-black text-white dark:bg-white dark:text-black">
              3
            </div>

            <h3 className="text-2xl font-semibold mb-3 text-black dark:text-white">
              Add Music, Generate & Listen
            </h3>

            <p className="text-black/80 dark:text-gray-300">
              Choose transition music, then generate natural, clear audio using the voices you selected.
              Preview instantly, then download or share your episode.
            </p>

            <p className="mt-3 text-sm text-black/60 dark:text-gray-400">
              Natural Voices • Script Editing • Instant Playback
            </p>
          </StepCard>

        </ol>


        {/* CTA (unchanged size) */}
        <div className="mt-10 flex flex-col items-center gap-3">
          <a
            href="'#/create'"
            className="btn-cta
                       "
          >
            Try WeCast Now
          </a>
          <p className="text-xs text-black/60 dark:text-gray-400">No signup required to test it.</p>
        </div>
      </div>
    </section>
  );
}
