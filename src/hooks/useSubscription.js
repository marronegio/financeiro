import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

// Retorna { status: 'loading' | 'active' | 'inactive',
// plan: 'free' | 'solo' | 'duo', tier: 'free' | 'solo' | 'duo',
// trialing, provider: 'stripe' | 'asaas', aiEnabled: boolean }.
//
// `plan` é o que está gravado no perfil e `status` é o acesso (se a assinatura
// está em dia). `tier` combina os dois e é o que o app deve consultar: sem
// assinatura ativa, o tier é 'free' — ninguém mais fica trancado do lado de
// fora, só com menos recursos (ver src/limits.js).
// Regra única de "acesso pago em dia": status ativo (ou em teste, legado do
// Stripe) E dentro do período já pago. O access_until é indispensável aqui —
// quem cancela continua com subscription_status 'active' de propósito, até a
// data expirar (ver supabase/functions/asaas-cancel). Exportada porque o
// polling do checkout precisa exatamente do mesmo critério: olhar só o status
// fazia o PaywallModal dar um pagamento por confirmado que nunca aconteceu.
export function hasPaidAccess(row) {
  const notExpired = !row?.access_until || new Date(row.access_until).getTime() > Date.now();
  const paid = row?.subscription_status === 'active' || row?.subscription_status === 'trialing';
  return paid && notExpired;
}

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
      const paidOk = hasPaidAccess(data);
      // Override do painel admin tem a palavra final: 'active' libera mesmo sem
      // pagamento, 'inactive' bloqueia mesmo pagando, null = usa a lógica normal.
      const ok = data?.admin_override === 'active'
        ? true
        : data?.admin_override === 'inactive'
        ? false
        : paidOk;
      // Repassa o plano como está no banco (o admin pode marcar 'free'); só
      // valores desconhecidos caem no padrão 'solo'.
      const plan = ['free', 'solo', 'duo'].includes(data?.plan) ? data.plan : 'solo';
      setResolved({
        uid: user.id,
        status: ok ? 'active' : 'inactive',
        plan,
        // Sem acesso em dia, o tier é grátis — e o admin pode marcar 'free'
        // mesmo com assinatura ativa.
        tier: ok && plan !== 'free' ? plan : 'free',
        trialing,
        provider: data?.payment_provider === 'asaas' ? 'asaas' : 'stripe',
        aiEnabled: data?.ai_enabled !== false, // default true (coluna pode faltar em bases antigas)
      });
    }

    check();
    return () => { ignore = true; };
  }, [user]);

  if (!user) return { status: 'inactive', plan: 'solo', tier: 'free', trialing: false, provider: 'stripe', aiEnabled: true };
  // Enquanto não houver resultado verificado para ESTE usuário, seguimos carregando
  // (evita o flash de um dashboard limitado para quem é assinante).
  if (!resolved || resolved.uid !== user.id) return { status: 'loading', plan: 'solo', tier: 'free', trialing: false, provider: 'stripe', aiEnabled: true };
  return {
    status: resolved.status,
    plan: resolved.plan,
    tier: resolved.tier,
    trialing: resolved.trialing,
    provider: resolved.provider,
    aiEnabled: resolved.aiEnabled,
  };
}
