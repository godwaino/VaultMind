/** Public web env (NEXT_PUBLIC_* are safe to embed; no secrets here). */
export const ENV = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  /** base URL of the backend API project (empty = same origin) */
  apiBase: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
};

export function isSupabaseConfigured(): boolean {
  return Boolean(ENV.supabaseUrl && ENV.supabaseAnonKey);
}
