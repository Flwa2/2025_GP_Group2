import React from "react";
import { Facebook, Twitter, Youtube, Instagram } from "lucide-react";

const EMAIL = "team@wecast.ai";
const SOCIAL = {
  facebook: "https://facebook.com/",
  twitter: "https://twitter.com/",
  instagram: "https://instagram.com/",
  youtube: "https://youtube.com/",
};

const QUICK_LINKS = [
  { label: "Home", href: "/" },
  { label: "Create Script", href: "/create" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "About Us", href: "/about" },
];

export default function Footer() {
  const mailto = `mailto:${EMAIL}?subject=${encodeURIComponent(
    "WeCast — Contact"
  )}`;

  return (
<footer className="bg-black dark:bg-[#101020] text-white dark:text-gray-200 transition-colors pt-20 duration-500">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
        
        {/* Brand Logo + Name */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            {/* ROTATING LOGO */}
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
            {QUICK_LINKS.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="hover:text-white transition">
                  {item.label}
                </a>
              </li>
            ))}
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

          <div className="flex gap-4 mt-4">
            <a href={SOCIAL.facebook} target="_blank" rel="noopener noreferrer">
              <Facebook className="w-5 h-5 text-white/70 hover:text-white transition-colors" />
            </a>
            <a href={SOCIAL.twitter} target="_blank" rel="noopener noreferrer">
              <Twitter className="w-5 h-5 text-white/70 hover:text-white transition-colors" />
            </a>
            <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer">
              <Youtube className="w-5 h-5 text-white/70 hover:text-white transition-colors" />
            </a>
            <a href={SOCIAL.instagram} target="_blank" rel="noopener noreferrer">
              <Instagram className="w-5 h-5 text-white/70 hover:text-white transition-colors" />
            </a>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-white/10 text-center text-xs text-white/45">
        © {new Date().getFullYear()} WeCast — All rights reserved.
      </div>
    </footer>
  );
}
