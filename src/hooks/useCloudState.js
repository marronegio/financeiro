import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';

// Carrega o estado financeiro do usuário a partir da tabela `finances` (uma linha
// por usuário, coluna `state` em JSONB) e regrava com debounce a cada mudança.
export function useCloudState(userId, makeInitial) {
  const [state, setState] = useState(null); // null enquanto carrega
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const saveTimer = useRef(null);
  const skipNextSave = useRef(true);

  // ----- carregar ao logar / trocar de usuário -----
  useEffect(() => {
    if (!userId) return;
    let active = true;
    setStatus('loading');
    skipNextSave.current = true;

    (async () => {
      const initial = typeof makeInitial === 'function' ? makeInitial() : makeInitial;
      const { data, error } = await supabase
        .from('finances')
        .select('state')
        .eq('user_id', userId)
        .maybeSingle();

      if (!active) return;
      if (error) {
        console.error('Falha ao carregar dados:', error);
        setState(initial);
        setStatus('error');
        return;
      }
      setState(data?.state ? { ...initial, ...data.state } : initial);
      setStatus('ready');
    })();

    return () => {
      active = false;
    };
    // makeInitial é estável (função importada); só reagimos ao usuário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ----- salvar (debounced) -----
  useEffect(() => {
    if (status === 'loading' || !userId || state == null) return;
    // Pula a primeira gravação logo após o carregamento.
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      supabase
        .from('finances')
        .upsert({ user_id: userId, state, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) console.error('Falha ao salvar dados:', error);
        });
    }, 600);

    return () => clearTimeout(saveTimer.current);
  }, [state, status, userId]);

  return [state, setState, status];
}
