import { useEffect, useState } from 'react';
import { syncStatusBarWithTheme } from './lib/native.js';

// O tema fica no atributo data-theme do <html> (aplicado por um script inline no
// index.html, sem flash) e é persistido no localStorage. Tema é preferência de
// dispositivo/UI, então localStorage é o lugar certo (não é dado do usuário).
//
// Preferência ≠ aplicação: o tema escuro salvo só vale DENTRO do dashboard.
// Landing, telas de auth e afins ficam sempre claras — o App decide qual tela
// está visível e chama applyTheme; setTheme (toggle nas Configurações) persiste
// a preferência e aplica na hora, já que só existe dentro do dashboard.

const listeners = new Set();

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

// Preferência salva (o que o usuário escolheu), independente do que está na tela.
export function storedTheme() {
  try {
    return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

// Aplica um tema na tela sem mexer na preferência salva.
export function applyTheme(t) {
  const theme = t === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  syncStatusBarWithTheme(theme); // app nativo: ícones da status bar acompanham o fundo
  listeners.forEach((l) => l(theme));
}

export function setTheme(t) {
  const theme = t === 'dark' ? 'dark' : 'light';
  try {
    localStorage.setItem('theme', theme);
  } catch {
    /* ignore */
  }
  applyTheme(theme);
}

// Hook que reflete e altera o tema, sincronizado entre todos os pontos da UI.
export function useTheme() {
  const [theme, setThemeState] = useState(getTheme);
  useEffect(() => {
    const l = (t) => setThemeState(t);
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
  return {
    theme,
    setTheme,
    toggle: () => setTheme(getTheme() === 'dark' ? 'light' : 'dark'),
  };
}
