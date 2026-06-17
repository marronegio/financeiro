import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

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
    signUp: (email, password) =>
      supabase.auth.signUp({
        email,
        password,
        // Link de confirmação volta para a origem onde o cadastro foi feito
        // (produção em produção, localhost em dev). Precisa estar na allowlist
        // de Redirect URLs do Supabase.
        options: { emailRedirectTo: window.location.origin },
      }),
    signIn: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    resetPassword: (email) =>
      supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
