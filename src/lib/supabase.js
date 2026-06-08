import { createClient } from '@supabase/supabase-js';

// As chaves vêm do .env (prefixo VITE_ para o Vite expor no client).
// Copie .env.example para .env e preencha com os dados do seu projeto Supabase.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// A anon key é pública por design — a segurança real fica nas policies (RLS) do banco.
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
