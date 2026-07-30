"use client";

import { useEffect } from "react";

/**
 * Blocks right-click, text selection, and common devtools/view-source shortcuts.
 * Cosmetic only — anything shipped to the browser remains readable via devtools
 * regardless. Does not run for inputs/textareas so form fields stay usable.
 */
export default function ContentGuard() {
  useEffect(() => {
    const isFormField = (target: EventTarget | null) =>
      target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(target.tagName);

    function onContextMenu(e: MouseEvent) {
      if (!isFormField(e.target)) e.preventDefault();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isFormField(e.target)) return;
      const blocked =
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key)) ||
        (e.ctrlKey && ["u", "s"].includes(e.key.toLowerCase()));
      if (blocked) e.preventDefault();
    }

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}
