// src/components/CurvedWeCast.jsx
import React from "react";

export default function CurvedWeCast({ className = "", variant = "hero" }) {
  const letters = "WeCast".split("");

  const curves = {
    hero: { y: [12, 6, -10, -14, -8, 4], r: [-18, -10, -4, 4, 10, 18] },
    logo: { y: [6, 3, -4, -6, -3, 2],   r: [-10, -6, -2, 2, 6, 10] },
  };
  const { y, r } = curves[variant] ?? curves.hero;

  return (
    <span
      className={`curved-wecast inline-flex select-none 
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
