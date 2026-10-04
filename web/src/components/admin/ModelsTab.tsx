"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ModelVersion } from "@/lib/types";

export function ModelsTab() {
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await createClient()
      .from("model_versions")
      .select("id, model_key, name, kind, is_active, notes, created_at")
      .order("created_at", { ascending: false });
    if (error) setError("Impossible de charger les modèles.");
    setModels((data ?? []) as ModelVersion[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function activate(model: ModelVersion) {
    if (!window.confirm(`Activer « ${model.model_key} » ? Toutes les nouvelles analyses utiliseront cette version.`)) return;
    setBusyId(model.id);
    setError(null);
    const { error } = await createClient().rpc("activate_model", { p_id: model.id });
    setBusyId(null);
    if (error) {
      setError("L'activation a échoué.");
      return;
    }
    await load();
  }

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setAdding(true);
    setError(null);
    const { error } = await createClient().from("model_versions").insert({
      model_key: String(form.get("model_key") ?? "").trim(),
      name: String(form.get("name") ?? "").trim(),
      kind: String(form.get("kind")) === "ensemble" ? "ensemble" : "single",
      notes: String(form.get("notes") ?? "").trim() || null,
    });
    setAdding(false);
    if (error) {
      setError(
        error.code === "23505"
          ? "Cette clé de modèle existe déjà."
          : error.code === "23514"
            ? "Clé invalide : minuscules, chiffres, « . », « _ » ou « - » (64 caractères max)."
            : "L'ajout a échoué.",
      );
      return;
    }
    formEl.reset();
    await load();
  }

  if (loading) return <p className="text-muted" role="status">Chargement…</p>;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-labelledby="models-list">
        <h2 id="models-list" className="mb-2 text-lg font-semibold">Versions de modèles</h2>
        {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
        {models.length === 0 ? (
          <p className="card p-4 text-sm text-muted">Aucun modèle enregistré.</p>
        ) : (
          <ul className="card divide-y divide-border">
            {models.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">
                    {m.name} <span className="font-mono text-sm text-muted">{m.model_key}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {m.kind === "ensemble" ? "Ensemble" : "Modèle simple"} · ajouté le {new Date(m.created_at).toLocaleDateString("fr-FR")}
                    {m.notes ? ` · ${m.notes}` : ""}
                  </p>
                </div>
                {m.is_active ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-success/50 px-3 py-1 text-sm text-success">
                    <CheckCircle2 size={16} aria-hidden /> Actif
                  </span>
                ) : (
                  <button type="button" disabled={busyId === m.id} onClick={() => activate(m)} className="btn-secondary !py-2">
                    {busyId === m.id && <Loader2 size={16} className="animate-spin" aria-hidden />} Activer
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside>
        <form onSubmit={onAdd} className="card space-y-4 p-5">
          <h2 className="text-lg font-semibold">Enregistrer une version</h2>
          <p className="rounded-lg border border-warn/50 bg-warn/10 px-3 py-2 text-xs">
            La clé doit correspondre à un fichier <code>inference-api/configs/&lt;clé&gt;.yaml</code> et à des poids déployés sur l'API d'inférence. Sinon, les analyses échoueront avec « modèle indisponible ».
          </p>
          <div>
            <label htmlFor="model_key" className="mb-1.5 block text-sm font-medium">Clé</label>
            <input id="model_key" name="model_key" className="field font-mono" placeholder="densenet121-v2" pattern="[a-z0-9][a-z0-9._-]{0,63}" required />
          </div>
          <div>
            <label htmlFor="model_name" className="mb-1.5 block text-sm font-medium">Nom</label>
            <input id="model_name" name="name" className="field" placeholder="DenseNet121" required />
          </div>
          <div>
            <label htmlFor="model_kind" className="mb-1.5 block text-sm font-medium">Type</label>
            <select id="model_kind" name="kind" className="field" defaultValue="single">
              <option value="single">Modèle simple</option>
              <option value="ensemble">Ensemble</option>
            </select>
          </div>
          <div>
            <label htmlFor="model_notes" className="mb-1.5 block text-sm font-medium">Notes (facultatif)</label>
            <input id="model_notes" name="notes" className="field" maxLength={200} />
          </div>
          <button type="submit" disabled={adding} className="btn-primary w-full">
            {adding ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Plus size={16} aria-hidden />} Enregistrer
          </button>
        </form>
      </aside>
    </div>
  );
}
