import { createClient, SupabaseClient, User } from "jsr:@supabase/supabase-js@2";
import { HttpError } from "./http.ts";

/** Client agissant AVEC les droits (et la RLS) de l'utilisateur appelant. */
export function userClient(req: Request): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
}

/** Client service role : contourne la RLS. À n'utiliser qu'après contrôle d'accès explicite. */
export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

export interface Caller {
  user: User;
  role: "doctor" | "admin";
  supabase: SupabaseClient;
}

/** Vérifie le JWT, puis que le compte est approuvé et possède l'un des rôles autorisés. */
export async function requireCaller(req: Request, allowed: Array<"doctor" | "admin">): Promise<Caller> {
  if (!req.headers.get("Authorization")) throw new HttpError(401, "unauthenticated", "Authentification requise.");

  const supabase = userClient(req);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new HttpError(401, "unauthenticated", "Session invalide ou expirée.");

  const { data: profile } = await supabase.from("profiles").select("role, approved").eq("id", user.id).maybeSingle();
  if (!profile?.approved) throw new HttpError(403, "not_approved", "Votre compte n'a pas encore été validé.");
  if (!allowed.includes(profile.role)) throw new HttpError(403, "forbidden", "Action non autorisée pour votre rôle.");

  return { user, role: profile.role, supabase };
}
