import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

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

// Botão físico de voltar do Android: volta no histórico do webview quando dá,
// senão minimiza o app (comportamento padrão de apps nativos).
export function initNativeApp() {
  if (!isNativeApp) return;
  CapApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else CapApp.minimizeApp();
  });
}
