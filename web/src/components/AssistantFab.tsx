"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageCircle, Wrench, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

/** Bouton flottant en bas à droite : l'assistant est en maintenance, une boîte de dialogue l'indique. */
export function AssistantFab() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab") {
        // Un seul élément focusable dans la boîte : on garde le focus dessus.
        e.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      fabRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <motion.button
        ref={fabRef}
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-fg shadow-lg shadow-primary/30 hover:bg-primary/90"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.4 }}
        aria-haspopup="dialog"
      >
        <MessageCircle size={20} aria-hidden />
        <span className="hidden sm:inline">{t("assistant.fab")}</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="assistant-title"
              aria-describedby="assistant-body"
              className="card w-full max-w-sm p-6 text-center shadow-2xl"
              initial={{ y: 30, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            >
              <motion.div
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warn/15 text-warn"
                animate={{ rotate: [0, -12, 12, -8, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.2 }}
              >
                <Wrench size={26} aria-hidden />
              </motion.div>
              <h2 id="assistant-title" className="mt-4 text-lg font-semibold">{t("assistant.title")}</h2>
              <p id="assistant-body" className="mt-2 text-sm leading-relaxed text-muted">{t("assistant.body")}</p>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} className="btn-primary mt-6 w-full">
                <X size={16} aria-hidden /> {t("assistant.ok")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
