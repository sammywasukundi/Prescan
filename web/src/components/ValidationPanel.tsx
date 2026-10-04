"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check, Loader2, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ClassInfo, Prediction } from "@/lib/types";

interface Props {
  prediction: Prediction;
  classes: ClassInfo[];
  labels: Record<string, string>;
  onValidated: (p: Prediction) => void;
}

export function ValidationPanel({ prediction, classes, labels, onValidated }: Props) {
  const [correcting, setCorrecting] = useState(false);
  const [correctedClass, setCorrectedClass] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(status: "confirmed" | "corrected") {
    if (status === "corrected" && !correctedClass) {
      setError("Choisissez la classe que vous retenez.");
      return;
    }
    setBusy(true);
    setError(null);
    // La base n'autorise que ces champs : le résultat du modèle est immuable (trigger predictions_guard).
    const { data, error } = await createClient()
      .from("predictions")
      .update({
        validation_status: status,
        corrected_class: status === "corrected" ? correctedClass : null,
        doctor_feedback: feedback.trim() || null,
      })
      .eq("id", prediction.id)
      .select()
      .single();
    setBusy(false);
    if (error || !data) {
      setError("La validation n'a pas pu être enregistrée. Réessayez.");
      return;
    }
    onValidated(data as Prediction);
  }

  if (prediction.validation_status !== "pending") {
    const corrected = prediction.validation_status === "corrected";
    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} role="status" className="rounded-xl border border-success/50 bg-success/10 p-4">
        <p className="flex items-center gap-2 font-medium text-success">
          <Check size={18} aria-hidden />
          {corrected ? "Résultat corrigé par le médecin" : "Résultat confirmé par le médecin"}
        </p>
        {corrected && prediction.corrected_class && (
          <p className="mt-1 text-sm">Classe retenue : <strong>{labels[prediction.corrected_class] ?? prediction.corrected_class}</strong></p>
        )}
        {prediction.doctor_feedback && <p className="mt-1 text-sm text-muted">Commentaire : {prediction.doctor_feedback}</p>}
        {prediction.validated_at && (
          <p className="mt-1 text-xs text-muted">Le {new Date(prediction.validated_at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}</p>
        )}
      </motion.div>
    );
  }

  return (
    <div className="card space-y-4 p-4">
      <div>
        <h3 className="font-semibold">Validation médicale</h3>
        <p className="text-sm text-muted">Confirmez le résultat ou indiquez la classe que vous retenez. Votre décision est enregistrée avec la date et votre identité.</p>
      </div>

      {correcting && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-3 overflow-hidden">
          <div>
            <label htmlFor="corrected" className="mb-1.5 block text-sm font-medium">Classe retenue</label>
            <select id="corrected" className="field" value={correctedClass} onChange={(e) => setCorrectedClass(e.target.value)}>
              <option value="">Sélectionner…</option>
              {classes.filter((c) => c.class_key !== prediction.predicted_class).map((c) => (
                <option key={c.class_key} value={c.class_key}>{c.label_fr}</option>
              ))}
            </select>
          </div>
        </motion.div>
      )}

      <div>
        <label htmlFor="feedback" className="mb-1.5 block text-sm font-medium">Commentaire (facultatif)</label>
        <textarea id="feedback" rows={2} maxLength={2000} className="field resize-y" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      </div>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap gap-3">
        {!correcting ? (
          <>
            <button type="button" disabled={busy} onClick={() => save("confirmed")} className="btn-primary">
              {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Check size={16} aria-hidden />} Confirmer le résultat
            </button>
            <button type="button" disabled={busy} onClick={() => setCorrecting(true)} className="btn-secondary">
              <Pencil size={16} aria-hidden /> Corriger
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => save("corrected")} className="btn-primary">
              {busy && <Loader2 size={16} className="animate-spin" aria-hidden />} Enregistrer la correction
            </button>
            <button type="button" disabled={busy} onClick={() => { setCorrecting(false); setError(null); }} className="btn-secondary">Annuler</button>
          </>
        )}
      </div>
    </div>
  );
}
