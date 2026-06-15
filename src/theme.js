import { useEffect, useState } from 'react';

// O tema fica no atributo data-theme do <html> (aplicado por um script inline no
// index.html, sem flash) e é persistido no localStorage. Tema é preferência de
// dispositivo/UI, então localStorage é o lugar certo (não é dado do usuário).

const listeners = new Set();

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function setTheme(t) {
  const theme = t === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('theme', theme);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l(theme));
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
