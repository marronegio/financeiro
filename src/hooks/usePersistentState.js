import { useEffect, useState } from 'react';

// useState que carrega o valor inicial do localStorage (mesclado com os padrões)
// e regrava a cada mudança. `makeInitial` pode ser um valor ou uma fábrica.
export function usePersistentState(key, makeInitial) {
  const [state, setState] = useState(() => {
    const initial = typeof makeInitial === 'function' ? makeInitial() : makeInitial;
    try {
      const v = localStorage.getItem(key);
      if (v) return { ...initial, ...JSON.parse(v) };
    } catch {
      /* localStorage indisponível ou JSON inválido — usa o padrão */
    }
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* ignora falhas de escrita (modo privado, cota cheia, etc.) */
    }
  }, [key, state]);

  return [state, setState];
}
