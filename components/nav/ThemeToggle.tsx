"use client";

import { useEffect, useState } from "react";

type Choice = "system" | "light" | "dark";

const NEXT: Record<Choice, Choice> = { system: "light", light: "dark", dark: "system" };
const GLYPH: Record<Choice, string> = { system: "◐", light: "☀", dark: "☾" };
const LABEL: Record<Choice, string> = {
  system: "Theme: follows your system",
  light: "Theme: light",
  dark: "Theme: dark",
};

export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>("system");

  // Read the stored choice after mount; the layout's inline script already
  // applied it to <html>, so this only syncs the button's own label.
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") setChoice(stored);
  }, []);

  function cycle() {
    const next = NEXT[choice];
    setChoice(next);
    if (next === "system") {
      localStorage.removeItem("theme");
      delete document.documentElement.dataset.theme;
    } else {
      localStorage.setItem("theme", next);
      document.documentElement.dataset.theme = next;
    }
  }

  return (
    <button type="button" className="btn btn-sm" onClick={cycle} title={LABEL[choice]}>
      <span aria-hidden="true">{GLYPH[choice]}</span>
      <span className="sr-only">{LABEL[choice]}. Activate to change.</span>
    </button>
  );
}
