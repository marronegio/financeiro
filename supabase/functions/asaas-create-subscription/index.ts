// Cria uma assinatura no ASAAS para o usuário logado.
//
// Dois métodos, escolhidos pelo frontend:
//  - CREDIT_CARD → devolve { redirectUrl } (checkout hospedado do ASAAS). O usuário
//    paga lá, o ASAAS tokeniza o cartão e cobra sozinho nos próximos ciclos.
//  - PIX → devolve { pix: { encodedImage, payload } } para exibir o QR dentro do
//    DinPrev. Sem débito automático: a cada ciclo o ASAAS gera uma nova cobrança
//    que o usuário paga de novo.
//
// O acesso NÃO é liberado aqui — só quando o asaas-webhook confirmar o pagamento.
// Segredos necessários: ASAAS_API_KEY (chave do painel), e opcional ASAAS_API_URL.
// verify_jwt = true (config.toml): exige usuário logado.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Produção por padrão; dá pra apontar pro sandbox via secret sem mexer no código.
const ASAAS_URL = Deno.env.get('ASAAS_API_URL') || 'https://api.asaas.com/v3'

const onlyDigits = (s: string) => (s || '').replace(/\D/g, '')

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

// Fonte da verdade dos preços fica NO SERVIDOR — o frontend só manda a chave do
// plano. Espelha o plans.js. Valor em reais; ciclo no formato do ASAAS.
const PLAN_CONFIG: Record<string, { tier: 'solo' | 'duo'; value: number; cycle: 'MONTHLY' | 'YEARLY'; label: string }> = {
  'solo-monthly': { tier: 'solo', value: 37.9, cycle: 'MONTHLY', label: 'DinPrev Solo (Mensal)' },
  'solo-annual': { tier: 'solo', value: 238.8, cycle: 'YEARLY', label: 'DinPrev Solo (Anual)' },
  'duo-monthly': { tier: 'duo', value: 67.9, cycle: 'MONTHLY', label: 'DinPrev Duo (Mensal)' },
  'duo-annual': { tier: 'duo', value: 478.8, cycle: 'YEARLY', label: 'DinPrev Duo (Anual)' },
}

// Data de hoje em YYYY-MM-DD (horário de Brasília) para o primeiro vencimento.
function todayInSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return parts // en-CA já formata como YYYY-MM-DD
}

async function asaas(path: string, apiKey: string, init?: RequestInit) {
  const resp = await fetch(`${ASAAS_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
      ...(init?.headers || {}),
    },
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    const msg = data?.errors?.[0]?.description || `ASAAS ${resp.status}`
    throw new Error(msg)
  }
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

    // Autentica pelo JWT do usuário.
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

    const { plan, billingType } = await req.json()
    const config = PLAN_CONFIG[plan]
    if (!config) return json({ error: 'Plano inválido.' }, 400)
    const method = billingType === 'PIX' ? 'PIX' : 'CREDIT_CARD'

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('asaas_customer_id, asaas_subscription_id, subscription_status, cpf, access_until, referred_by, referral_counted')
      .eq('id', user.id)
      .single()

    const meta = (user.user_metadata as Record<string, unknown> | null) || {}
    const customerName =
      (meta.full_name as string) || (meta.name as string) || user.email || 'Cliente DinPrev'

    // Já ativo (ou em teste do Stripe): não cria nova assinatura. Mas se cancelou e
    // o acesso já expirou (access_until no passado), liberamos re-assinatura.
    const notExpired = !profile?.access_until || new Date(profile.access_until as string).getTime() > Date.now()
    const stillActive =
      (profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing') && notExpired
    if (stillActive) {
      return json({ error: 'Assinatura já ativa.' }, 400)
    }

    // CPF é obrigatório pro ASAAS. Igual ao fluxo antigo: profiles.cpf é a fonte,
    // com fallback pro metadata do cadastro (validado e persistido).
    let cpf = onlyDigits(profile?.cpf || '')
    if (!cpf) {
      const metaCpf = onlyDigits((user.user_metadata as Record<string, unknown> | null)?.cpf as string || '')
      if (metaCpf && isValidCPF(metaCpf)) {
        cpf = metaCpf
        await supabaseAdmin.from('profiles').upsert({ id: user.id, cpf })
      }
    }
    if (!cpf || !isValidCPF(cpf)) {
      return json({ error: 'CPF inválido ou ausente. Refaça o cadastro com um CPF válido.' }, 400)
    }

    // Programa de indicação — vincula quem indicou (uma vez só). O código usado
    // no cadastro fica no metadata (`ref`); resolvemos aqui porque este é o
    // primeiro ponto do fluxo com service role. Auto-indicação não vale: nem a
    // própria conta, nem outra conta com o mesmo CPF.
    let referredBy = (profile?.referred_by as string | null) || null
    const referralCounted = profile?.referral_counted === true
    if (!referredBy && !referralCounted) {
      const refCode = String((meta.ref as string) || '').trim().toUpperCase()
      if (refCode) {
        const { data: referrer } = await supabaseAdmin
          .from('profiles')
          .select('id, cpf')
          .eq('referral_code', refCode)
          .maybeSingle()
        if (referrer && referrer.id !== user.id && onlyDigits(referrer.cpf || '') !== cpf) {
          referredBy = referrer.id
          await supabaseAdmin.from('profiles').upsert({ id: user.id, referred_by: referredBy })
        }
      }
    }

    // Bônus do indicado: 10% na PRIMEIRA mensalidade (só plano mensal; o crédito
    // de quem indicou é consumido nas renovações, pelo webhook). Sem estado a
    // consumir aqui: a elegibilidade expira sozinha quando o 1º pagamento
    // confirmar (referral_counted vira true no credit_referral).
    const referredDiscountPct =
      config.cycle === 'MONTHLY' && referredBy && !referralCounted ? 10 : 0

    // Customer no ASAAS: reutiliza o salvo; senão cria e persiste.
    let customerId = profile?.asaas_customer_id
    if (!customerId) {
      const customer = await asaas('/customers', apiKey, {
        method: 'POST',
        body: JSON.stringify({
          name: customerName,
          email: user.email,
          cpfCnpj: cpf,
          externalReference: user.id,
        }),
      })
      customerId = customer.id
      await supabaseAdmin
        .from('profiles')
        .upsert({ id: user.id, asaas_customer_id: customerId })
    }

    // Evita assinaturas órfãs acumulando: se havia uma pendente, remove antes.
    if (profile?.asaas_subscription_id) {
      try {
        await asaas(`/subscriptions/${profile.asaas_subscription_id}`, apiKey, { method: 'DELETE' })
      } catch (e) {
        console.warn('Falha ao remover assinatura anterior (seguindo):', (e as Error).message)
      }
    }

    // Cria a assinatura. Primeiro vencimento hoje → primeira cobrança já disponível.
    const subscription = await asaas('/subscriptions', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        customer: customerId,
        billingType: method,
        value: config.value,
        nextDueDate: todayInSaoPaulo(),
        cycle: config.cycle,
        description: config.label,
        externalReference: user.id,
      }),
    })

    // Guarda o vínculo. Inclui o asaas_customer_id aqui também pra garantir que ele
    // persista (o webhook localiza o perfil por ele/pelo externalReference). O status
    // só vira 'active' quando o webhook confirmar o pagamento.
    await supabaseAdmin
      .from('profiles')
      .update({
        payment_provider: 'asaas',
        asaas_customer_id: customerId,
        asaas_subscription_id: subscription.id,
        plan: config.tier,
        // Ciclo do plano — define o limite mensal de créditos de IA (250/900).
        plan_cycle: config.cycle === 'YEARLY' ? 'annual' : 'monthly',
        subscription_status: 'pending',
        access_until: null, // nova assinatura zera qualquer expiração de cancelamento anterior
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    // Busca a primeira cobrança da assinatura.
    const payments = await asaas(`/subscriptions/${subscription.id}/payments`, apiKey)
    const firstPayment = payments?.data?.[0]
    if (!firstPayment) return json({ error: 'Cobrança não gerada. Tente novamente.' }, 502)

    // Aplica o bônus de indicação SÓ na primeira cobrança (a assinatura mantém o
    // valor cheio — as renovações não têm desconto por aqui). Best-effort: se a
    // atualização falhar, o checkout segue no valor cheio.
    let discountPct = 0
    if (referredDiscountPct > 0) {
      const discounted = Math.round(config.value * (1 - referredDiscountPct / 100) * 100) / 100
      try {
        await asaas(`/payments/${firstPayment.id}`, apiKey, {
          method: 'PUT',
          body: JSON.stringify({
            billingType: method,
            value: discounted,
            dueDate: firstPayment.dueDate,
          }),
        })
        discountPct = referredDiscountPct
      } catch (e) {
        console.warn('Falha ao aplicar desconto de indicação (seguindo no valor cheio):', (e as Error).message)
      }
    }

    if (method === 'CREDIT_CARD') {
      // Checkout hospedado: o usuário informa o cartão na página do ASAAS.
      return json({ method, redirectUrl: firstPayment.invoiceUrl, discountPct })
    }

    // PIX: devolve o QR (imagem base64) e o copia-e-cola pra exibir no app.
    // O QR é gerado DEPOIS do desconto, então já sai no valor com abatimento.
    const pix = await asaas(`/payments/${firstPayment.id}/pixQrCode`, apiKey)
    return json({
      method,
      paymentId: firstPayment.id,
      discountPct,
      pix: {
        encodedImage: pix.encodedImage,
        payload: pix.payload,
        expirationDate: pix.expirationDate,
      },
    })
  } catch (err) {
    console.error(err)
    return json({ error: (err as Error).message }, 500)
  }
})
