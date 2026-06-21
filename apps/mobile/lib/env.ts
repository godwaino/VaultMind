import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string; supabaseAnonKey?: string; apiBase?: string;
};

export const ENV = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey ?? "",
  apiBase: process.env.EXPO_PUBLIC_API_BASE_URL ?? extra.apiBase ?? "",
};

export const isConfigured = () => Boolean(ENV.supabaseUrl && ENV.supabaseAnonKey);
