import React from 'react';

function AvailableOn() {
  const platforms = [
    "APPLE PODCASTS",
    "SPOTIFY", 
    "STITCHER",
    "GOOGLE PODCASTS"
  ];

  return (
    <section className="bg-purple-light py-20 px-6">
      <div className="max-w-4xl mx-auto text-center space-y-12">
        <h2 className="text-4xl font-bold text-black">
          AVAILABLE ON
        </h2>
        
        <div className="flex flex-wrap justify-center gap-4">
          {platforms.map((platform, index) => (
            <button
              key={index}
              className="bg-black text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors text-sm"
            >
              {platform}
            </button>
          ))}
        </div>
        
        {/* Decorative abstract illustration */}
        <div className="relative mt-16 h-32">
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-2xl h-24 bg-gradient-to-r from-blue-bright via-pink-bright to-orange-bright rounded-lg opacity-60"></div>
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-20 h-16 bg-yellow-bright rounded-full"></div>
          <div className="absolute bottom-8 left-1/3 w-12 h-12 bg-green-bright rounded-full opacity-80"></div>
          <div className="absolute bottom-2 right-1/3 w-8 h-8 bg-purple-medium rounded-full"></div>
        </div>
      </div>
    </section>
  );
}

export default AvailableOn;
