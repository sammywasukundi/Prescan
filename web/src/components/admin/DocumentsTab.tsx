"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { FileUp, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { RagDocument } from "@/lib/types";
import { useI18n } from "@/lib/i18n/client";
import { dateLocale } from "@/lib/i18n/core";

const MAX_FILE_BYTES = 500 * 1024;

export function DocumentsTab() {
  const { t, locale } = useI18n();
  const [docs, setDocs] = useState<RagDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [content, setContent] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await createClient()
      .from("rag_documents")
      .select("id, title, source, is_active, created_at, rag_chunks(count)")
      .order("created_at", { ascending: false });
    if (error) setError(t("doc.loadError"));
    setDocs((data ?? []) as unknown as RagDocument[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError(t("doc.tooBig"));
      return;
    }
    setError(null);
    setContent(await file.text());
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIndexing(true);
    setError(null);
    setNotice(null);
    const { data, error } = await createClient().functions.invoke("rag-ingest", {
      body: { title: title.trim(), source: source.trim() || undefined, content },
    });
    setIndexing(false);
    if (error) {
      let message = t("doc.indexFailed");
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => null);
        message = body?.error?.message ?? message;
      }
      setError(message);
      return;
    }
    setNotice(t("doc.indexed", { n: data?.chunks ?? "?" }));
    setTitle("");
    setSource("");
    setContent("");
    if (fileRef.current) fileRef.current.value = "";
    await load();
  }

  async function toggle(doc: RagDocument) {
    setBusyId(doc.id);
    setError(null);
    const { error } = await createClient().from("rag_documents").update({ is_active: !doc.is_active }).eq("id", doc.id);
    setBusyId(null);
    if (error) setError(t("acc.updateFailed"));
    else await load();
  }

  async function remove(doc: RagDocument) {
    if (!window.confirm(t("doc.confirmDelete", { title: doc.title }))) return;
    setBusyId(doc.id);
    setError(null);
    const { error } = await createClient().from("rag_documents").delete().eq("id", doc.id);
    setBusyId(null);
    if (error) setError(t("doc.deleteFailed"));
    else await load();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section aria-labelledby="docs-list">
        <h2 id="docs-list" className="mb-2 text-lg font-semibold">{t("doc.base")}</h2>
        {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
        {notice && <p role="status" className="mb-3 text-sm text-success">{notice}</p>}
        {loading ? (
          <p className="text-muted" role="status">{t("common.loading")}</p>
        ) : docs.length === 0 ? (
          <p className="card p-4 text-sm text-muted">{t("doc.none")}</p>
        ) : (
          <ul className="card divide-y divide-border">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.title}</p>
                  <p className="truncate text-xs text-muted">
                    {t("doc.chunks", { n: d.rag_chunks?.[0]?.count ?? 0 })} · {new Date(d.created_at).toLocaleDateString(dateLocale(locale))}
                    {d.source ? ` · ${d.source}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={busyId === d.id} onClick={() => toggle(d)} className="btn-secondary !py-2" aria-pressed={d.is_active}>
                    {d.is_active ? t("doc.active") : t("doc.inactive")}
                  </button>
                  <button type="button" disabled={busyId === d.id} onClick={() => remove(d)} className="btn-secondary !px-3 !py-2" aria-label={t("doc.deleteAria", { title: d.title })}>
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside>
        <form onSubmit={onSubmit} className="card space-y-4 p-5">
          <h2 className="text-lg font-semibold">{t("doc.add")}</h2>
          <p className="text-xs text-muted">
            {t("doc.addNote")}
          </p>
          <div>
            <label htmlFor="doc-title" className="mb-1.5 block text-sm font-medium">{t("doc.title")}</label>
            <input id="doc-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
          </div>
          <div>
            <label htmlFor="doc-source" className="mb-1.5 block text-sm font-medium">{t("doc.source")}</label>
            <input id="doc-source" className="field" value={source} onChange={(e) => setSource(e.target.value)} maxLength={500} />
          </div>
          <div>
            <label htmlFor="doc-file" className="mb-1.5 block text-sm font-medium">{t("doc.file")}</label>
            <input id="doc-file" ref={fileRef} type="file" accept=".md,.txt,text/plain,text/markdown" className="field !p-2 text-sm" onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
          <div>
            <label htmlFor="doc-content" className="mb-1.5 block text-sm font-medium">{t("doc.content")}</label>
            <textarea id="doc-content" className="field resize-y" rows={7} value={content} onChange={(e) => setContent(e.target.value)} minLength={50} required />
          </div>
          <button type="submit" disabled={indexing} className="btn-primary w-full">
            {indexing ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <FileUp size={16} aria-hidden />}
            {indexing ? t("doc.indexing") : t("doc.index")}
          </button>
        </form>
      </aside>
    </div>
  );
}
