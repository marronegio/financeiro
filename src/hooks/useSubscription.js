import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

// Retorna { status: 'loading' | 'active' | 'inactive', plan: 'solo' | 'duo', trialing }.
export function useSubscription(user) {
  // Guardamos o resultado junto do uid a que ele pertence, pra nunca devolver
  // um status defasado de outro usuário (ou do estado deslogado).
  const [resolved, setResolved] = useState(null); // { uid, status, plan, trialing } | null

  useEffect(() => {
    let ignore = false;

    if (!user) {
      setResolved({ uid: null, status: 'inactive', plan: 'solo', trialing: false });
      return;
    }

    async function check() {
      const { data } = await supabase
        .from('profiles')
        .select('subscription_status, plan')
        .eq('id', user.id)
        .single();

      if (ignore) return;
      // Durante o teste grátis o status no Stripe é 'trialing' — também libera acesso.
      const trialing = data?.subscription_status === 'trialing';
      const ok = data?.subscription_status === 'active' || trialing;
      setResolved({
        uid: user.id,
        status: ok ? 'active' : 'inactive',
        plan: data?.plan === 'duo' ? 'duo' : 'solo',
        trialing,
      });
    }

    check();
    return () => { ignore = true; };
  }, [user]);

  if (!user) return { status: 'inactive', plan: 'solo', trialing: false };
  // Enquanto não houver resultado verificado para ESTE usuário, seguimos carregando
  // (evita o flash da tela de assinatura logo após o login).
  if (!resolved || resolved.uid !== user.id) return { status: 'loading', plan: 'solo', trialing: false };
  return { status: resolved.status, plan: resolved.plan, trialing: resolved.trialing };
}
