// src/components/Footer.jsx
import React from "react";

const EMAIL = "WeCast@gmail.com";

export default function Footer() {
  const mailto = `mailto:${EMAIL}?subject=${encodeURIComponent(
    "WeCast — Contact"
  )}`;

  const navigateToSection = (sectionId) => {
    // If we're not on home page, go to home first then scroll
    if (window.location.hash !== '#/' && window.location.hash !== '') {
      window.location.hash = '#/';
      setTimeout(() => {
        const el = document.querySelector(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    } else {
      // If we're already on home, just scroll to section
      const el = document.querySelector(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  return (
    <footer className="bg-black dark:bg-[#101020] text-white dark:text-gray-200 transition-colors pt-20 duration-500">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
        
        {/* Brand Logo + Name */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <img
              src="/logo.png"
              alt="WeCast Logo"
              className="w-12 h-12 object-contain animate-spin-slow hover:animate-spin-fast"
            />
            <h3 className="text-4xl font-extrabold tracking-wider italic">
              WeCast
            </h3>
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
          <ul className="space-y-3 text-white/70 text-sm">
            <li>
              <a href="#/" className="hover:text-white transition">
                Home
              </a>
            </li>
            <li>
              <a href="#/create" className="hover:text-white transition">
                Create Script
              </a>
            </li>
            <li>
              <a 
                href="#episodes"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToSection("#episodes");
                }}
                className="hover:text-white transition cursor-pointer"
              >
                How It Works
              </a>
            </li>
            <li>
              <a 
                href="#about"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToSection("#about");
                }}
                className="hover:text-white transition cursor-pointer"
              >
                About Us
              </a>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="text-lg font-semibold mb-4">Contact Us</h4>
          <a
            href={mailto}
            className="text-white/80 underline underline-offset-4 hover:text-white transition"
          >
            {EMAIL}
          </a>
        </div>
      </div>

      {/* Copyright */}
      <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-white/10 text-center text-xs text-white/45">
        © {new Date().getFullYear()} WeCast — All rights reserved.
      </div>
    </footer>
  );
}
