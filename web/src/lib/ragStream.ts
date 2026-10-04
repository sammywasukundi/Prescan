import { createClient } from "./supabase/client";

export interface RagSource {
  index: number;
  title: string;
  source: string | null;
  snippet: string;
  similarity: number;
}

export interface RagHandlers {
  onSources: (sources: RagSource[]) => void;
  onDelta: (text: string) => void;
}

export const RAG_ERRORS: Record<number, string> = {
  401: "Votre session a expiré. Reconnectez-vous.",
  403: "Votre compte n'a pas accès à l'assistant.",
  429: "Trop de demandes. Patientez un instant avant de poser une nouvelle question.",
};

export class RagError extends Error {}

/** Appelle l'Edge Function `rag-chat` et lit le flux SSE (sources, puis texte au fil de l'eau). */
export async function streamRagAnswer(
  message: string,
  history: { role: "user" | "assistant"; content: string }[],
  handlers: RagHandlers,
  signal: AbortSignal,
): Promise<void> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new RagError(RAG_ERRORS[401]);

  let response: Response;
  try {
    response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/rag-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify({ message, history }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new RagError("Connexion impossible. Vérifiez votre réseau et réessayez.");
  }

  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null);
    throw new RagError(body?.error?.message ?? RAG_ERRORS[response.status] ?? "L'assistant est momentanément indisponible.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const event = /^event: (.+)$/m.exec(block)?.[1];
      const raw = /^data: (.+)$/m.exec(block)?.[1];
      if (!event || !raw) continue;
      const data = JSON.parse(raw);
      if (event === "sources") handlers.onSources(data as RagSource[]);
      else if (event === "delta") handlers.onDelta(String(data.text ?? ""));
      else if (event === "error") throw new RagError(data.message ?? "La réponse a été interrompue.");
    }
  }
}
