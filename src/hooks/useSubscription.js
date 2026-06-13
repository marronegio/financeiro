import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

// Retorna 'loading' | 'active' | 'inactive'
export function useSubscription(user) {
  // Guardamos o resultado junto do uid a que ele pertence, pra nunca devolver
  // um status defasado de outro usuário (ou do estado deslogado).
  const [resolved, setResolved] = useState(null); // { uid, status } | null

  useEffect(() => {
    let ignore = false;

    if (!user) {
      setResolved({ uid: null, status: 'inactive' });
      return;
    }

    async function check() {
      const { data } = await supabase
        .from('profiles')
        .select('subscription_status')
        .eq('id', user.id)
        .single();

      if (ignore) return;
      // Durante o teste grátis o status no Stripe é 'trialing' — também libera acesso.
      const ok = data?.subscription_status === 'active' || data?.subscription_status === 'trialing';
      setResolved({ uid: user.id, status: ok ? 'active' : 'inactive' });
    }

    check();
    return () => { ignore = true; };
  }, [user]);

  if (!user) return 'inactive';
  // Enquanto não houver resultado verificado para ESTE usuário, seguimos carregando
  // (evita o flash da tela de assinatura logo após o login).
  if (!resolved || resolved.uid !== user.id) return 'loading';
  return resolved.status;
}
