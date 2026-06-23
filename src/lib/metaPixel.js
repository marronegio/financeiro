// Wrapper fino sobre o Meta Pixel (fbq), carregado no index.html.
//
// Centraliza a checagem de que o fbq existe antes de chamar — assim um ad blocker,
// o pixel ainda não carregado, ou rodar fora do browser (SSR/testes) nunca quebram
// a aplicação. Use estas funções em vez de chamar window.fbq direto.

/**
 * Dispara um evento padrão do Meta Pixel (Standard Event).
 * @param {string} eventName Nome do evento (ex.: 'CompleteRegistration', 'Purchase').
 * @param {Record<string, unknown>} [params] Parâmetros opcionais (ex.: { value, currency }).
 */
export function trackMetaEvent(eventName, params) {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    if (params) window.fbq('track', eventName, params);
    else window.fbq('track', eventName);
  }
}
