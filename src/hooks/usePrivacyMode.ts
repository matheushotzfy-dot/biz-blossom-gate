import { useState, useCallback } from "react";

export function usePrivacyMode() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem("privacy_mode") === "true";
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("privacy_mode", String(next));
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  return { hidden, toggle };
}
