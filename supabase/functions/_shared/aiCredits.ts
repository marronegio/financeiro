// Gate de créditos de IA — compartilhado por ai-assistant e ai-transcribe.
//
// Cada chamada que gasta dinheiro na OpenAI consome 1 crédito do mês do usuário
// (tabela ai_usage, via RPC consume_ai_credit — ver a migration ai_credits).
// O limite depende do ciclo do plano (profiles.plan_cycle):
//   monthly ou desconhecido → 250   |   annual → 900
// Dá pra ajustar sem mexer no código:
//   supabase secrets set AI_CREDITS_MONTHLY=300 AI_CREDITS_ANNUAL=1000

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hasPaidAccess, userIdFromRequest } from './auth.ts'

const LIMIT_MONTHLY = Number(Deno.env.get('AI_CREDITS_MONTHLY') || 250)
const LIMIT_ANNUAL = Number(Deno.env.get('AI_CREDITS_ANNUAL') || 900)

// Tenta consumir 1 crédito do usuário desta requisição.
// Retorna null quando pode seguir, ou uma Response pronta (401/429) para
// devolver ao cliente. Erros internos (banco fora do ar etc.) "falham aberto":
// um soluço no Postgres não deve derrubar o assistente — só loga e deixa passar.
export async function consumeAiCredit(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

  const userId = userIdFromRequest(req)
  if (!userId) {
    // Com verify_jwt = true isso não deveria acontecer; se acontecer, nega.
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: jsonHeaders,
    })
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('plan, plan_cycle, subscription_status, access_until, admin_override, ai_enabled')
    .eq('id', userId)
    .maybeSingle()
  if (profileError) {
    console.error('Créditos de IA: falha ao ler o plano (seguindo):', profileError.message)
    return null
  }

  // Tier grátis não tem assistente. Esta checagem é a que vale: a interface
  // esconde o Mr. Din no grátis, mas quem chamar a função direto tem que bater
  // aqui — cada chamada custa dinheiro na OpenAI.
  if (!hasPaidAccess(profile) || profile?.plan === 'free') {
    return new Response(
      JSON.stringify({
        error: 'upgrade_required',
        message: 'O assistente com IA faz parte do plano Pro.',
      }),
      { status: 402, headers: jsonHeaders },
    )
  }

  // Liga/desliga da IA pelo painel admin. false = bloqueia mesmo com créditos.
  // (null/ausente = habilitado, para não quebrar bases anteriores à coluna.)
  if (profile?.ai_enabled === false) {
    return new Response(
      JSON.stringify({
        error: 'ai_disabled',
        message: 'O assistente de IA está indisponível para a sua conta.',
      }),
      { status: 403, headers: jsonHeaders },
    )
  }

  const limit = profile?.plan_cycle === 'annual' ? LIMIT_ANNUAL : LIMIT_MONTHLY
  const { data: allowed, error } = await admin.rpc('consume_ai_credit', {
    p_user: userId,
    p_limit: limit,
  })
  if (error) {
    console.error('Créditos de IA: falha ao consumir (seguindo):', error.message)
    return null
  }

  if (!allowed) {
    return new Response(
      JSON.stringify({
        error: 'limit_reached',
        message: 'Seus créditos de IA deste mês acabaram 😅 Eles renovam no dia 1º.',
      }),
      { status: 429, headers: jsonHeaders },
    )
  }

  return null
}
