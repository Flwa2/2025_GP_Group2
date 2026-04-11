// src/components/CurvedWeCast.jsx
import React from "react";
export default function CurvedWeCast({ className = "", variant = "hero" }) {
  const letters = "WeCast".split("");
  const isStatic = variant === "heroFlat";

  if (isStatic) {
    return (
      <span
        className={`curved-wecast hero-flat-mark inline-block whitespace-nowrap select-none text-purple-medium dark:text-white transition-colors duration-500 ${className}`}
      >
        WeCast
      </span>
    );
  }

  const curves = {
    hero: { y: [9, 4, -6, -9, -6, -5], r: [-14, -8, -3, 3, 8, 12] },
    heroStable: { y: [8, 4, -3, -5, -3, -3], r: [-12, -7, -2, 2, 7, 10] },
    heroFlat: { y: [0, 0, 0, 0, 0, 0], r: [0, 0, 0, 0, 0, 0] },
    logo: { y: [6, 3, -4, -6, -3, 2],   r: [-10, -6, -2, 2, 6, 10] }, 
  }; 
  const { y, r } = curves[variant] ?? curves.hero;

  return (
    <span
      className={`curved-wecast inline-flex select-none 
                  whitespace-nowrap
                  text-purple-medium dark:text-white 
                  transition-colors duration-500 ${className}`}
    >
      {letters.map((ch, i) => (
        <span
          key={i}
          className="curved-letter"
          style={{
            ["--y"]: `${y[i]}px`,
            ["--r"]: `${r[i]}deg`,
            ["--delay"]: `${i * 100}ms`,
          }}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}
