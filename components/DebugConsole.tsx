"use client";

import { useEffect } from "react";

/**
 * Loads the Eruda mobile console when the URL has ?debug=1, so errors can be
 * inspected directly on a phone without a desktop browser. No-op otherwise.
 */
export function DebugConsole() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") !== "1") return;
    if ((window as any).eruda) return;

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/eruda";
    script.onload = () => {
      (window as any).eruda?.init();
    };
    document.body.appendChild(script);
  }, []);

  return null;
}
