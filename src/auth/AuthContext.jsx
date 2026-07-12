import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { siteUrl } from '../lib/native.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  // true quando o usuário abriu o link de recuperação de senha (deve ver a tela
  // de "definir nova senha" em vez do app).
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    let active = true;

    // Sessão atual ao carregar (pega também o retorno do OAuth via URL).
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    // Mantém o estado em sincronia com login/logout/refresh de token.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Disparado quando o link do e-mail de recuperação é aberto.
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    recovery,
    clearRecovery: () => setRecovery(false),
    signUp: (email, password, cpf, ref) =>
      supabase.auth.signUp({
        email,
        password,
        // CPF guardado no metadata; vira a chave do controle de teste grátis
        // (persistido em profiles.cpf no primeiro checkout). `ref` é o código de
        // indicação de quem convidou — resolvido no 1º checkout (referred_by).
        // Link de confirmação volta para a origem do cadastro (precisa estar na
        // allowlist do Supabase).
        options: { data: { cpf: cpf || null, ref: ref || null }, emailRedirectTo: siteUrl },
      }),
    signIn: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    resetPassword: (email) =>
      supabase.auth.resetPasswordForEmail(email, { redirectTo: siteUrl }),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
