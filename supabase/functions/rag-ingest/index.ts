// POST /functions/v1/rag-ingest   (administrateur)
// { "title": "...", "source": "https://… ou référence", "content": "texte brut du document" }
// Découpe le texte en passages, calcule les embeddings et les enregistre.

import { requireCaller, serviceClient } from "../_shared/auth.ts";
import { corsHeaders, errorResponse, HttpError, json } from "../_shared/http.ts";
import { embed } from "../_shared/embeddings.ts";

const MAX_CONTENT_CHARS = 200_000;
const CHUNK_TARGET = 900;
const CHUNK_OVERLAP = 120;

/** Découpe par paragraphes, en regroupant jusqu'à ~CHUNK_TARGET caractères avec un léger chevauchement. */
export function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current && current.length + p.length + 2 > CHUNK_TARGET) {
      chunks.push(current);
      current = current.slice(-CHUNK_OVERLAP) + "\n\n" + p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
    while (current.length > CHUNK_TARGET * 2) {
      chunks.push(current.slice(0, CHUNK_TARGET));
      current = current.slice(CHUNK_TARGET - CHUNK_OVERLAP);
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = serviceClient();
  let documentId: string | null = null;

  try {
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "Méthode non autorisée.");
    const { user } = await requireCaller(req, ["admin"]);

    const body = await req.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const source = typeof body?.source === "string" ? body.source.trim().slice(0, 500) : null;
    if (!title || title.length > 200) throw new HttpError(400, "invalid_request", "Titre requis (200 caractères max).");
    if (content.length < 50) throw new HttpError(400, "invalid_request", "Contenu trop court.");
    if (content.length > MAX_CONTENT_CHARS) throw new HttpError(413, "content_too_large", "Document trop volumineux.");

    const { data: doc, error: docError } = await admin
      .from("rag_documents")
      .insert({ title, source: source || null, content, created_by: user.id })
      .select("id")
      .single();
    if (docError || !doc) throw new HttpError(500, "ingest_failed", "Le document n'a pas pu être enregistré.");
    documentId = doc.id;

    const chunks = chunkText(content);
    const rows = [];
    for (let i = 0; i < chunks.length; i++) {
      rows.push({ document_id: doc.id, chunk_index: i, content: chunks[i], embedding: await embed(chunks[i]) });
    }
    const { error: chunkError } = await admin.from("rag_chunks").insert(rows);
    if (chunkError) throw new HttpError(500, "ingest_failed", "L'indexation du document a échoué.");

    await admin.from("audit_logs").insert({
      actor_id: user.id, action: "rag.ingest", entity_type: "rag_documents", entity_id: doc.id,
      metadata: { title, chunks: rows.length },
    });
    return json({ document_id: doc.id, chunks: rows.length }, 201);
  } catch (e) {
    if (documentId) await admin.from("rag_documents").delete().eq("id", documentId); // pas de document à moitié indexé
    return errorResponse(e);
  }
});
