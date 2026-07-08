import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

// Retorna { status: 'loading' | 'active' | 'inactive', plan: 'solo' | 'duo',
// trialing, provider: 'stripe' | 'asaas', aiEnabled: boolean }.
export function useSubscription(user) {
  // Guardamos o resultado junto do uid a que ele pertence, pra nunca devolver
  // um status defasado de outro usuário (ou do estado deslogado).
  const [resolved, setResolved] = useState(null); // { uid, status, plan, trialing, provider, aiEnabled } | null

  useEffect(() => {
    let ignore = false;

    if (!user) {
      setResolved({ uid: null, status: 'inactive', plan: 'solo', trialing: false, provider: 'stripe', aiEnabled: true });
      return;
    }

    async function check() {
      const { data } = await supabase
        .from('profiles')
        .select('subscription_status, plan, payment_provider, access_until, admin_override, ai_enabled')
        .eq('id', user.id)
        .single();

      if (ignore) return;
      // Durante o teste grátis (legado Stripe) o status é 'trialing' — libera acesso.
      const trialing = data?.subscription_status === 'trialing';
      // Cancelamento no fim do período: mantém acesso enquanto access_until estiver
      // no futuro; quando a data passa, expira (cai no paywall).
      const notExpired = !data?.access_until || new Date(data.access_until).getTime() > Date.now();
      const paidOk = (data?.subscription_status === 'active' || trialing) && notExpired;
      // Override do painel admin tem a palavra final: 'active' libera mesmo sem
      // pagamento, 'inactive' bloqueia mesmo pagando, null = usa a lógica normal.
      const ok = data?.admin_override === 'active'
        ? true
        : data?.admin_override === 'inactive'
        ? false
        : paidOk;
      setResolved({
        uid: user.id,
        status: ok ? 'active' : 'inactive',
        plan: data?.plan === 'duo' ? 'duo' : 'solo',
        trialing,
        provider: data?.payment_provider === 'asaas' ? 'asaas' : 'stripe',
        aiEnabled: data?.ai_enabled !== false, // default true (coluna pode faltar em bases antigas)
      });
    }

    check();
    return () => { ignore = true; };
  }, [user]);

  if (!user) return { status: 'inactive', plan: 'solo', trialing: false, provider: 'stripe', aiEnabled: true };
  // Enquanto não houver resultado verificado para ESTE usuário, seguimos carregando
  // (evita o flash da tela de assinatura logo após o login).
  if (!resolved || resolved.uid !== user.id) return { status: 'loading', plan: 'solo', trialing: false, provider: 'stripe', aiEnabled: true };
  return { status: resolved.status, plan: resolved.plan, trialing: resolved.trialing, provider: resolved.provider, aiEnabled: resolved.aiEnabled };
}
