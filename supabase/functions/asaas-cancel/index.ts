// Cancela a assinatura ASAAS do usuário logado — no FIM do período já pago.
//
// Em vez de revogar na hora, paramos as cobranças futuras (deletamos a assinatura
// no ASAAS) e mantemos o acesso até o próximo vencimento (nextDueDate), gravado em
// profiles.access_until. O gate de acesso (useSubscription) expira sozinho nessa
// data — sem precisar de cron. verify_jwt = true (config.toml).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ASAAS_URL = Deno.env.get('ASAAS_API_URL') || 'https://api.asaas.com/v3'

async function asaas(path: string, apiKey: string, init?: RequestInit) {
  const resp = await fetch(`${ASAAS_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', access_token: apiKey, ...(init?.headers || {}) },
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(data?.errors?.[0]?.description || `ASAAS ${resp.status}`)
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const apiKey = Deno.env.get('ASAAS_API_KEY')
    if (!apiKey) return json({ error: 'ASAAS_API_KEY não configurada.' }, 500)

    const authHeader = req.headers.get('Authorization')!
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) return json({ error: 'Não autorizado.' }, 401)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('asaas_subscription_id')
      .eq('id', user.id)
      .single()

    const revokeNow = () =>
      supabaseAdmin
        .from('profiles')
        .update({
          subscription_status: 'canceled',
          asaas_subscription_id: null,
          access_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

    const subId = profile?.asaas_subscription_id

    // Sem assinatura no ASAAS: nada a agendar, revoga o acesso agora.
    if (!subId) {
      await revokeNow()
      return json({ ok: true, immediate: true })
    }

    // Descobre até quando já está pago (próximo vencimento da assinatura).
    let nextDueDate = ''
    try {
      const sub = await asaas(`/subscriptions/${subId}`, apiKey)
      nextDueDate = (sub?.nextDueDate as string) || ''
    } catch (err) {
      console.warn('Falha ao ler assinatura no ASAAS:', (err as Error).message)
    }

    // Para as cobranças futuras (remove a assinatura). Ignora erro de já-removida.
    try {
      await asaas(`/subscriptions/${subId}`, apiKey, { method: 'DELETE' })
    } catch (err) {
      console.warn('Falha ao remover assinatura no ASAAS (seguindo):', (err as Error).message)
    }

    // Sem data de vencimento: não dá pra agendar com segurança, revoga agora.
    if (!nextDueDate) {
      await revokeNow()
      return json({ ok: true, immediate: true })
    }

    // Mantém o acesso até o fim do dia do próximo vencimento (horário de Brasília).
    const accessUntil = new Date(`${nextDueDate}T23:59:59-03:00`)
    await supabaseAdmin
      .from('profiles')
      .update({
        subscription_status: 'active', // continua ativo até expirar por access_until
        access_until: accessUntil.toISOString(),
        asaas_subscription_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    return json({
      ok: true,
      immediate: false,
      accessUntil: Math.floor(accessUntil.getTime() / 1000),
    })
  } catch (err) {
    console.error(err)
    return json({ error: (err as Error).message }, 500)
  }
})
