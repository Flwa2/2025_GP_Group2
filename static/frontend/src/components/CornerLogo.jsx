import React from "react";
import CurvedWeCast from "./CurvedWeCast";

export default function CornerLogo() {
  return (
    <a href="/" className="corner-logo block" aria-label="WeCast Home">
      <CurvedWeCast className="text-2xl md:text-3xl" />
    </a>
  );
}
