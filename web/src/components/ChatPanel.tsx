"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, Send, Square } from "lucide-react";
import { RagError, streamRagAnswer, type RagSource } from "@/lib/ragStream";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: RagSource[];
  error?: string;
}

const SUGGESTIONS = [
  "Comment PreScan analyse-t-il une échographie ?",
  "Que signifie une confiance faible ?",
  "Quelles sont les limites du modèle ?",
  "Comment fonctionne la validation médicale ?",
];

/** Transforme les marqueurs [1], [2] du texte en boutons qui mettent la source en évidence. */
function WithCitations({ text, onCite }: { text: string; onCite: (n: number) => void }) {
  return (
    <>
      {text.split(/(\[\d+\])/g).map((part, i) => {
        const m = /^\[(\d+)\]$/.exec(part);
        if (!m) return <Fragment key={i}>{part}</Fragment>;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onCite(Number(m[1]))}
            className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-primary/15 px-1 align-baseline text-xs font-semibold text-primary hover:bg-primary/25"
            aria-label={`Voir la source ${m[1]}`}
          >
            {m[1]}
          </button>
        );
      })}
    </>
  );
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [activeSource, setActiveSource] = useState<{ messageId: string; index: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string) {
    const question = text.trim();
    if (!question || streaming) return;

    const history = messages
      .filter((m) => !m.error && m.content)
      .map((m) => ({ role: m.role, content: m.content }));
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: question },
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setInput("");
    setStreaming(true);

    const patch = (fn: (m: Message) => Message) => setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamRagAnswer(
        question,
        history,
        {
          onSources: (sources) => patch((m) => ({ ...m, sources })),
          onDelta: (delta) => patch((m) => ({ ...m, content: m.content + delta })),
        },
        controller.signal,
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        patch((m) => ({ ...m, error: e instanceof RagError ? e.message : "L'assistant est momentanément indisponible." }));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-[28rem] flex-col">
      <div className="mb-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-muted" role="note">
        L'assistant explique PreScan, les classes d'anomalies et les limites du modèle à partir de la base documentaire. Il ne pose aucun diagnostic et n'interprète aucune image.
      </div>

      <div className="card flex-1 space-y-5 overflow-y-auto p-4" aria-live="polite" aria-busy={streaming}>
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <BookOpen size={28} className="text-primary" aria-hidden />
            <p className="text-muted">Posez une question sur PreScan.</p>
            <div className="flex max-w-xl flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="btn-secondary !py-2 text-left">{s}</button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className={m.role === "user" ? "flex justify-end" : ""}>
              {m.role === "user" ? (
                <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-fg">{m.content}</p>
              ) : (
                <div className="max-w-[92%] space-y-3">
                  {m.content ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      <WithCitations text={m.content} onCite={(n) => setActiveSource({ messageId: m.id, index: n })} />
                    </p>
                  ) : !m.error ? (
                    <p className="flex gap-1 py-1" aria-label="L'assistant rédige sa réponse">
                      {[0, 1, 2].map((d) => (
                        <motion.span key={d} className="h-2 w-2 rounded-full bg-muted" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />
                      ))}
                    </p>
                  ) : null}

                  {m.error && <p role="alert" className="rounded-lg border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">{m.error}</p>}

                  {m.sources && m.sources.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted">Sources</p>
                      <ul className="space-y-1.5">
                        {m.sources.map((s) => {
                          const active = activeSource?.messageId === m.id && activeSource.index === s.index;
                          return (
                            <li key={s.index} className={`rounded-lg border px-3 py-2 text-xs transition-colors ${active ? "border-primary bg-primary/10" : "border-border"}`}>
                              <p className="font-medium">
                                <span className="mr-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-primary/15 px-1 text-primary">{s.index}</span>
                                {s.source && /^https?:\/\//.test(s.source) ? (
                                  <a href={s.source} target="_blank" rel="noopener noreferrer" className="underline">{s.title}</a>
                                ) : (
                                  s.title
                                )}
                                {s.source && !/^https?:\/\//.test(s.source) && <span className="font-normal text-muted"> — {s.source}</span>}
                              </p>
                              <p className="mt-1 line-clamp-2 text-muted">{s.snippet}…</p>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-3 flex gap-2">
        <label htmlFor="chat-input" className="sr-only">Votre question</label>
        <input
          id="chat-input"
          className="field"
          value={input}
          maxLength={1000}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Posez votre question…"
          autoComplete="off"
        />
        {streaming ? (
          <button type="button" onClick={() => abortRef.current?.abort()} className="btn-secondary shrink-0" aria-label="Arrêter la réponse">
            <Square size={16} aria-hidden /> Arrêter
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()} className="btn-primary shrink-0">
            <Send size={16} aria-hidden /> Envoyer
          </button>
        )}
      </form>
    </div>
  );
}
