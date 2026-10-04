// Embeddings calculés dans l'Edge Runtime avec le modèle gte-small de Supabase (384 dimensions).
// Aucun contenu n'est envoyé à un service tiers pour l'indexation ou la recherche.
// deno-lint-ignore no-explicit-any
declare const Supabase: any;

let session: { run: (input: string, opts: Record<string, unknown>) => Promise<ArrayLike<number>> } | null = null;

/** Retourne le vecteur au format texte « [0.1,0.2,…] » accepté par pgvector. */
export async function embed(text: string): Promise<string> {
  session ??= new Supabase.ai.Session("gte-small");
  const vector = await session!.run(text, { mean_pool: true, normalize: true });
  return JSON.stringify(Array.from(vector));
}
