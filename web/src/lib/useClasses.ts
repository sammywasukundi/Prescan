"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "./supabase/client";
import { useI18n } from "./i18n/client";
import type { ClassInfo } from "./types";

/** Charge les 16 classes (libellés français) et fournit un dictionnaire class_key → libellé. */
export function useClasses() {
  const { locale } = useI18n();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("abnormality_classes")
      .select("class_index, class_key, label_fr, label_en, description_fr")
      .order("class_index")
      .then(({ data }) => {
        if (cancelled) return;
        setClasses((data ?? []) as ClassInfo[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const labels = useMemo(() => Object.fromEntries(classes.map((c) => [c.class_key, locale === "en" ? c.label_en || c.label_fr : c.label_fr])), [classes, locale]);
  return { classes, labels, loading };
}
