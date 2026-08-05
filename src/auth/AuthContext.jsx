import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  siteUrl, isNativeApp, OAUTH_REDIRECT_URL, openOAuthUrl, initOAuthDeepLink,
} from '../lib/native.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  // true quando o usuário abriu o link de recuperação de senha (deve ver a tela
  // de "definir nova senha" em vez do app).
  const [recovery, setRecovery] = useState(false);
  // Erro do login social vindo do deep link (o app volta do navegador sem sessão).
  const [oauthError, setOauthError] = useState('');

  // App nativo: recebe os tokens da volta do Google e cria a sessão. No
  // navegador não há deep link — o próprio supabase-js lê a URL de retorno
  // (detectSessionInUrl) e o onAuthStateChange abaixo faz o resto.
  useEffect(
    () =>
      initOAuthDeepLink(
        async ({ access_token, refresh_token }) => {
          setOauthError('');
          await supabase.auth.setSession({ access_token, refresh_token });
        },
        (msg) => setOauthError(msg || 'Não foi possível entrar com o Google.')
      ),
    []
  );

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
    signUp: (email, password, ref) =>
      supabase.auth.signUp({
        email,
        password,
        // O cadastro não pede mais CPF: ele só é necessário para o ASAAS emitir a
        // cobrança, então é pedido na hora de assinar (ver PaywallModal). `ref` é
        // o código de indicação de quem convidou — resolvido no 1º checkout
        // (referred_by). Link de confirmação volta para a origem do cadastro
        // (precisa estar na allowlist do Supabase).
        options: { data: { ref: ref || null }, emailRedirectTo: siteUrl },
      }),
    signIn: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    // Login com o Google. No navegador, o Supabase redireciona a própria página
    // e a sessão volta na URL. No app, o Google proíbe OAuth em WebView: pedimos
    // a URL sem redirecionar (`skipBrowserRedirect`) e abrimos no navegador do
    // sistema — a volta chega pelo deep link tratado acima.
    signInWithGoogle: async () => {
      setOauthError('');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: OAUTH_REDIRECT_URL,
          skipBrowserRedirect: isNativeApp,
        },
      });
      if (error) return { error };
      if (isNativeApp && data?.url) {
        try {
          await openOAuthUrl(data.url);
        } catch (e) {
          return { error: e };
        }
      }
      return { error: null };
    },
    oauthError,
    clearOauthError: () => setOauthError(''),
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
