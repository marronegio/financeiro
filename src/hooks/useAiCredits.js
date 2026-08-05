import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

// Saldo de créditos de IA do mês, para o cabeçalho do chat do Mr. Din.
//
// A tabela ai_usage tem uma linha por usuário/mês e uma policy de SELECT do
// próprio consumo — criada exatamente para isto (ver a migration ai_credits).
// Quem DECIDE se a chamada passa continua sendo o backend
// (supabase/functions/_shared/aiCredits.ts); aqui é só o placar.
//
// Espelha os limites de lá: 250 no ciclo mensal, 900 no anual. Se mudarem os
// secrets AI_CREDITS_MONTHLY/AI_CREDITS_ANNUAL, atualize estes números também.
const LIMIT_MONTHLY = 250;
const LIMIT_ANNUAL = 900;

// Mesmo formato e fuso da RPC, que usa to_char(now(), 'YYYY-MM') em UTC.
const currentMonth = () => new Date().toISOString().slice(0, 7);

export function useAiCredits(user) {
  // null enquanto não sabemos (carregando ou falhou) — a UI então mostra só o
  // "online", sem inventar um saldo.
  const [credits, setCredits] = useState(null);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    const [profileRes, usageRes] = await Promise.all([
      supabase.from('profiles').select('plan_cycle').eq('id', user.id).maybeSingle(),
      supabase
        .from('ai_usage')
        .select('credits')
        .eq('user_id', user.id)
        .eq('month', currentMonth())
        .maybeSingle(),
    ]);

    // Sem leitura do consumo não dá para dizer quanto sobrou: melhor não
    // mostrar nada do que mostrar o saldo cheio de quem já gastou.
    if (usageRes.error) {
      setCredits(null);
      return;
    }
    // O ciclo é secundário: se a leitura do perfil falhar, assume o mensal (o
    // mesmo padrão do backend para ciclo desconhecido).
    const limit = profileRes.data?.plan_cycle === 'annual' ? LIMIT_ANNUAL : LIMIT_MONTHLY;
    const used = usageRes.data?.credits || 0;
    setCredits({ used, limit, left: Math.max(0, limit - used) });
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { credits, refresh };
}
