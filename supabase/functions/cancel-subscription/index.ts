import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Autentica o usuário pelo JWT
    const authHeader = req.headers.get('Authorization')!
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Service role para ler/gravar o perfil sem RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_id')
      .eq('id', user.id)
      .single()

    const json = (body: Record<string, unknown>) =>
      new Response(JSON.stringify(body), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    // Revoga o acesso na hora (não depende do webhook chegar).
    const revokeNow = () =>
      supabaseAdmin
        .from('profiles')
        .update({
          subscription_status: 'canceled',
          subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

    const subId = profile?.subscription_id

    // Sem assinatura real no Stripe: só revoga o acesso.
    if (!subId) {
      await revokeNow()
      return json({ ok: true, immediate: true })
    }

    // Busca a assinatura para saber se ainda está no período de teste.
    let subscription: Stripe.Subscription | null = null
    try {
      subscription = await stripe.subscriptions.retrieve(subId)
    } catch (err) {
      console.warn('Assinatura não encontrada no Stripe, revogando acesso:', err.message)
      await revokeNow()
      return json({ ok: true, immediate: true })
    }

    // Durante o teste grátis: agenda o cancelamento para o fim do período. O usuário
    // mantém o acesso até lá e não é cobrado; o webhook (subscription.deleted) revoga
    // quando o teste terminar. NÃO mexe no status/acesso agora.
    if (subscription.status === 'trialing') {
      await stripe.subscriptions.update(subId, { cancel_at_period_end: true })
      const accessUntil = subscription.trial_end ?? subscription.current_period_end
      return json({ ok: true, immediate: false, accessUntil })
    }

    // Fora do teste: cancela de imediato e revoga o acesso na hora. Ignora erros de
    // "já cancelada / inexistente" — o objetivo final é revogar o acesso.
    try {
      await stripe.subscriptions.cancel(subId)
    } catch (err) {
      console.warn('Falha ao cancelar no Stripe (seguindo para revogar acesso):', err.message)
    }
    await revokeNow()
    return json({ ok: true, immediate: true })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
