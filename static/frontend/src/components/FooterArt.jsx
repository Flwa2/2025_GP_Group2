import React from 'react';

function FooterArt() {
  return (
<section className="bg-cream dark:bg-[#0a0a1a] text-black dark:text-white transition-colors pt-20 pb-20 md:pb-28 duration-500">
      <div className="max-w-6xl mx-auto relative h-64 rounded-2xl border-4 border-black overflow-hidden">
        
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-light via-blue-bright to-orange-bright">

          {/* ✅ WeCast Illustration (centered) */}
          <img
            src="/wecastfooter.png"   // Make sure the name matches your file in public/
            alt="WeCast Footer"
            className="absolute left-1/2 top-1/2 w-[65%] max-w-xl 
                       transform -translate-x-1/2 -translate-y-1/2 drop-shadow-lg"
          />

          {/* ✅ Abstract background shapes (unchanged) */}
          <div className="absolute top-8 left-12 w-24 h-16 bg-pink-bright rounded-full opacity-80 transform rotate-45"></div>
          <div className="absolute bottom-12 right-16 w-20 h-24 bg-green-bright rounded-lg transform -rotate-30 opacity-70"></div>
          <div className="absolute top-16 right-1/4 w-16 h-16 bg-purple-medium rounded-full opacity-60"></div>

          {/* ✅ Decorative symbols */}
          <div className="absolute top-4 left-1/3 text-2xl text-black">★</div>
          <div className="absolute bottom-4 right-1/3 text-xl text-white">◆</div>
          <div className="absolute top-12 right-12 text-lg text-black">●</div>
          <div className="absolute bottom-16 left-16 text-sm text-white">✦</div>

          {/* ✅ Small floating elements */}
          <div className="absolute top-1/4 left-1/4 w-6 h-6 bg-yellow-bright rounded-full"></div>
          <div className="absolute bottom-1/3 right-1/5 w-4 h-8 bg-pink-bright rounded-full transform rotate-45"></div>
        </div>
      </div>
    </section>
  );
}

export default FooterArt;
