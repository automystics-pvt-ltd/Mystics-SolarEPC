import { useEffect, useRef } from "react";

/**
 * Warns the user before leaving the page if there are unsaved changes.
 * Pass `isDirty = true` when the form has unsaved edits.
 */
export function useUnsavedChanges(isDirty: boolean, message?: string) {
  const msg = message ?? "You have unsaved changes. Are you sure you want to leave?";

  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = msg;
      return msg;
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, msg]);
}
