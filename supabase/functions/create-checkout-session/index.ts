import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const onlyDigits = (s: string) => (s || '').replace(/\D/g, '')

// Valida os dígitos verificadores do CPF (consistência do número, não existência).
function isValidCPF(value: string): boolean {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false
  const digit = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += parseInt(cpf[i], 10) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return digit(9) === parseInt(cpf[9], 10) && digit(10) === parseInt(cpf[10], 10)
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

    // Autentica o usuário pelo JWT enviado no header Authorization
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

    // Service role para ler/gravar em profiles sem RLS de usuário
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Busca ou cria o customer no Stripe
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, subscription_status, cpf')
      .eq('id', user.id)
      .single()

    // Se já tem assinatura ativa (ou em teste), não cria nova sessão
    if (profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing') {
      return new Response(JSON.stringify({ error: 'Assinatura já ativa.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let customerId = profile?.stripe_customer_id

    // Valida o customer salvo. Se ele não existir mais nesta conta/modo do Stripe
    // (id órfão de uma fase de testes ou de outra conta), descarta e recria — assim
    // o checkout nunca quebra com "No such customer".
    if (customerId) {
      try {
        const existing = await stripe.customers.retrieve(customerId)
        if (existing && existing.deleted) customerId = null
      } catch (err) {
        if (err && err.code === 'resource_missing') customerId = null
        else throw err
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      await supabaseAdmin
        .from('profiles')
        .upsert({ id: user.id, stripe_customer_id: customerId })
    }

    // CPF: source of truth é profiles.cpf (write-once). Se ainda não há, pega do
    // metadata do cadastro, valida e persiste — daí em diante não muda mais.
    let cpf = onlyDigits(profile?.cpf || '')
    if (!cpf) {
      const metaCpf = onlyDigits((user.user_metadata as Record<string, unknown> | null)?.cpf as string || '')
      if (metaCpf && isValidCPF(metaCpf)) {
        cpf = metaCpf
        await supabaseAdmin.from('profiles').upsert({ id: user.id, cpf })
      }
    }

    const { origin, plan } = await req.json()

    // 4 combinações tier × ciclo → 4 price IDs. Aceita as chaves novas
    // ('solo-monthly' etc.) e os valores antigos ('monthly'/'annual' = Solo).
    const PRICE_BY_PLAN: Record<string, string | undefined> = {
      'solo-monthly': Deno.env.get('STRIPE_PRICE_ID'),
      'solo-annual': Deno.env.get('STRIPE_PRICE_ID_ANNUAL'),
      'duo-monthly': Deno.env.get('STRIPE_PRICE_ID_DUO'),
      'duo-annual': Deno.env.get('STRIPE_PRICE_ID_DUO_ANNUAL'),
      // compatibilidade com versões anteriores do frontend
      monthly: Deno.env.get('STRIPE_PRICE_ID'),
      annual: Deno.env.get('STRIPE_PRICE_ID_ANNUAL'),
    }
    const priceId = PRICE_BY_PLAN[plan] ?? Deno.env.get('STRIPE_PRICE_ID')!

    // Teste grátis só para quem nunca usou. O controle é por CPF — assim a pessoa
    // não escapa criando outros e-mails. Contas antigas sem CPF (legado) seguem
    // elegíveis; todo cadastro novo exige CPF.
    let trialEligible = true
    if (cpf) {
      const { data: redemption } = await supabaseAdmin
        .from('trial_redemptions')
        .select('cpf')
        .eq('cpf', cpf)
        .maybeSingle()
      trialEligible = !redemption
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      ...(trialEligible ? { subscription_data: { trial_period_days: 7 } } : {}),
      success_url: `${origin}?payment=success`,
      cancel_url: `${origin}?payment=cancel`,
      locale: 'pt-BR',
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
