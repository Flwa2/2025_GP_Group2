import React from 'react';
import CurvedWeCast from "./CurvedWeCast";


function HeroSection() {
  return (
<section className="bg-cream dark:bg-[#0a0a1a] text-black dark:text-white transition-colors duration-500 py-20 px-6 pt-24">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <h1>
            <CurvedWeCast className="text-6xl lg:text-8xl" />
          </h1>


          <div className="relative">
            {/* Listen Now with animated circular icon */}
            <div className="transform rotate-12 text-sm font-medium text-black absolute -top-4 left-40 flex items-center space-x-2">
              <span className="text-sm animate-pulse text-black dark:text-gray-100">Start Casting!!</span>
              <div className="relative w-6 h-6">
                <div className="absolute inset-0 w-6 h-6 bg-pink-bright rounded-full animate-spin"></div>
                <div className="absolute top-1 left-1 w-4 h-4 bg-orange-bright rounded-full animate-pulse"></div>
                <div className="absolute top-2 left-2 w-2 h-2 bg-black rounded-full animate-bounce"></div>
              </div>
            </div>

            {/* Listen with animated circular icon */}
            <div className="transform -rotate-12 text-sm font-medium text-black absolute top-8 left-60 flex items-center space-x-2">
              <span className="text-sm animate-pulse text-black dark:text-gray-100">Turn Text to speech!</span>
              <div className="relative w-6 h-6">
                <div className="absolute inset-0 w-6 h-6 bg-blue-bright rounded-full animate-spin" style={{ animationDirection: 'reverse' }}></div>
                <div className="absolute top-1 left-1 w-4 h-4 bg-yellow-bright rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                <div className="absolute top-2 left-2 w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
              </div>
            </div>

            {/* Additional floating animated elements */}
            <div className="absolute -top-8 left-20 w-4 h-4 bg-purple-medium rounded-full animate-bounce" style={{ animationDelay: '1s' }}></div>
            <div className="absolute top-12 left-80 w-3 h-3 bg-green-bright rounded-full animate-pulse" style={{ animationDelay: '1.5s' }}></div>
          </div>
        </div>

        <div className="space-y-6 mt-10">
          <h2 className="text-3xl font-bold text-black dark:text-gray-100">
            Give Your Words a Voice<br />
            with WeCast
          </h2>

          <p className="text-lg text-black dark:text-gray-100 leading-relaxed">
            Whether it’s a blog post, essay, or research paper, WeCast transforms your text into a lifelike podcast episode ready to play in seconds.</p>
          <button className="btn-cta">
            <span className="relative z-10">Let’s WeCast It</span>
            <div className="absolute inset-0 bg-gradient-to-r from-pink-bright to-purple-medium opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
          </button>
        </div>
      </div>

      {/* Enhanced decorative abstract shapes with animation */}
      <div className="absolute top-20 right-20 w-32 h-32 bg-pink-bright rounded-full opacity-60 blur-xl animate-pulse"></div>
      <div className="absolute bottom-20 left-20 w-24 h-24 bg-blue-bright rounded-full opacity-40 blur-lg animate-bounce" style={{ animationDelay: '2s' }}></div>

      {/* Additional animated circular elements */}
      <div className="absolute top-32 left-32 w-8 h-8 bg-orange-bright rounded-full animate-spin opacity-70"></div>
      <div className="absolute bottom-32 right-32 w-6 h-6 bg-yellow-bright rounded-full animate-pulse opacity-80"></div>
      <div className="absolute top-1/2 right-12 w-10 h-10 bg-green-bright rounded-full animate-bounce opacity-60" style={{ animationDelay: '0.8s' }}></div>
    </section>
  );
}

export default HeroSection;
