import { Capacitor, SystemBars, SystemBarsStyle, SystemBarType } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

// true quando o código roda dentro do app empacotado (Android/iOS via Capacitor).
// No navegador (site/webapp) é false e nada aqui muda o comportamento atual.
export const isNativeApp = Capacitor.isNativePlatform();

// Dentro do app nativo a origem é https://localhost — inútil como destino de
// links de e-mail (confirmação/recuperação). Nesse caso usamos o site publicado,
// configurado em VITE_SITE_URL no .env (precisa estar na allowlist do Supabase).
export const siteUrl =
  isNativeApp && import.meta.env.VITE_SITE_URL
    ? import.meta.env.VITE_SITE_URL
    : window.location.origin;

// ── Login social (OAuth) ────────────────────────────────────────────
// O Google recusa OAuth dentro de WebView embutido (erro `disallowed_useragent`),
// então o app não pode simplesmente navegar para a tela de login: abre o
// navegador do sistema (Chrome Custom Tabs) e volta por deep link.
//
// Este é o endereço para onde o Supabase devolve o usuário depois do Google. No
// app é um esquema próprio, declarado no AndroidManifest e cadastrado na
// allowlist de Redirect URLs do Supabase; no navegador é a própria página.
export const OAUTH_REDIRECT_URL = isNativeApp
  ? 'com.dinprev.app://auth'
  : window.location.origin;

// Abre a tela de login do Google fora do WebView.
export const openOAuthUrl = (url) => Browser.open({ url });

// Volta do login: o deep link traz os tokens no fragmento
// (com.dinprev.app://auth#access_token=…&refresh_token=…). Repassa para quem
// souber criar a sessão e fecha o navegador. `onError` recebe a mensagem quando
// o usuário cancela ou o Google recusa.
//
// Devolve uma função de limpeza — o listener é nativo e sobrevive ao remount do
// React (o StrictMode monta duas vezes em desenvolvimento).
export function initOAuthDeepLink(onTokens, onError = () => {}) {
  if (!isNativeApp) return () => {};
  const handle = CapApp.addListener('appUrlOpen', ({ url }) => {
    const frag = (url || '').split('#')[1];
    if (!frag) return;
    const params = new URLSearchParams(frag);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) onTokens({ access_token, refresh_token });
    else onError(params.get('error_description') || params.get('error') || '');
    Browser.close().catch(() => {});
  });
  return () => { handle.then((h) => h.remove()).catch(() => {}); };
}

// Ícones da status bar acompanham o fundo da tela: fundo claro → ícones
// escuros (LIGHT) e vice-versa. Só a status bar — a gesture bar de baixo fica
// sobre o menu inferior navy, então mantém o estilo do config (ícones claros).
// Chamada pelo applyTheme (theme.js) a cada troca de tema/tela.
export function syncStatusBarWithTheme(theme) {
  if (!isNativeApp) return;
  const style = theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light;
  SystemBars.setStyle({ style, bar: SystemBarType.StatusBar }).catch(() => {});
}

// Botão físico de voltar do Android. Primeiro oferece o evento ao app
// (o Dashboard fecha o drawer ou volta para a aba anterior e chama
// preventDefault); sem ninguém tratando, volta no histórico do webview ou
// minimiza o app (comportamento padrão de apps nativos).
export function initNativeApp() {
  if (!isNativeApp) return;
  CapApp.addListener('backButton', ({ canGoBack }) => {
    const unhandled = window.dispatchEvent(
      new CustomEvent('dinprev-back', { cancelable: true })
    );
    if (!unhandled) return; // alguém deu preventDefault — já tratado
    if (canGoBack) window.history.back();
    else CapApp.minimizeApp();
  });
}
