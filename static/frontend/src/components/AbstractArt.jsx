// src/components/AbstractArt.jsx
import React from 'react';

function AbstractArt() {
  return (
<section className="bg-cream dark:bg-[#0a0a1a] text-black dark:text-white transition-colors duration-500">
      <div className="max-w-6xl mx-auto h-96 relative">
        
        {/* ===== img1 wallpaper behind the shapes ===== */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <img
            src="/img1.png"        
            alt="Abstract wallpaper"
  className="w-full h-full object-contain object-[center_top] opacity-90"
          />

          {/* Optional fade at top so it blends softly */}
          <div
            className="absolute inset-0"
            style={{
              WebkitMaskImage:
                "linear-gradient(to top, black 80%, transparent 100%)",
              maskImage: "linear-gradient(to top, black 80%, transparent 100%)",
            }}
          />
        </div>

        <div className="absolute left-1/4 top-1/2 transform -translate-y-1/2 w-48 h-48 z-10">
          <div className="w-full h-full bg-orange-bright rounded-full relative border-4 border-black">
            <div className="absolute inset-6 bg-blue-bright rounded-full">
              <div className="absolute inset-6 bg-purple-medium rounded-full">
                <div className="absolute inset-6 bg-yellow-bright rounded-full flex items-center justify-center">
                  <div className="w-4 h-4 bg-black rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* ===== Abstract shapes ===== */}
        <div className="absolute top-0 left-0 w-full h-full z-20">
          {/* Pink blob */}
          <div className="absolute top-12 right-1/4 w-32 h-24 bg-pink-bright rounded-full opacity-80 transform rotate-45"></div>
          
          {/* Blue shape */}
          <div className="absolute bottom-16 left-12 w-40 h-32 bg-blue-bright rounded-full opacity-70 transform -rotate-12"></div>
          
          {/* Yellow shape */}
          <div className="absolute top-8 left-1/3 w-24 h-36 bg-yellow-bright rounded-full opacity-60 transform rotate-12"></div>
          
          {/* Green */}
          <div className="absolute bottom-8 right-12 w-28 h-20 bg-green-bright rounded-full opacity-75 transform rotate-45"></div>
          
          {/* Purple cloud */}
          <div className="absolute top-1/2 left-12 w-36 h-24 bg-purple-light rounded-full opacity-60"></div>
          
          {/* Orange */}
          <div className="absolute bottom-1/4 right-1/3 w-20 h-28 bg-orange-bright rounded-full opacity-80 transform -rotate-30"></div>
        </div>
        
        {/* ===== Decorative elements ===== */}
        <div className="absolute top-16 left-1/2 text-2xl z-30">✦</div>
        <div className="absolute bottom-20 left-1/4 text-lg z-30">✧</div>
        <div className="absolute top-1/3 right-16 text-xl z-30">◆</div>
        <div className="absolute bottom-12 right-1/2 text-sm z-30">●</div>
        
        {/* ===== Cassette tape illustration ===== */}
        <div className="absolute top-1/4 right-20 w-24 h-16 bg-pink-bright rounded border-2 border-black z-30">
          <div className="absolute top-2 left-3 w-4 h-4 bg-black rounded-full"></div>
          <div className="absolute top-2 right-3 w-4 h-4 bg-black rounded-full"></div>
          <div className="absolute bottom-2 left-1 right-1 h-2 bg-yellow-bright rounded"></div>
        </div>
      </div>
    </section>
  );
}

export default AbstractArt;
