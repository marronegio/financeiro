// Webhook do ASAAS — sincroniza o pagamento com o acesso do usuário.
//
// O ASAAS chama esta função a cada evento e envia, no header `asaas-access-token`,
// o token que você configurou no painel. Validamos esse token (o ASAAS não assina
// os eventos como o Stripe). Depois, traduzimos o evento para o mesmo
// profiles.subscription_status que o resto do app já entende — então o gate de
// acesso (useSubscription) não muda nada.
//
// Programa de indicação (duas responsabilidades extras):
//   * 1º pagamento confirmado de um indicado → credit_referral() credita quem
//     indicou (+1 crédito de 10%);
//   * PAYMENT_CREATED de renovação mensal → consome até 10 créditos do assinante
//     e abate o valor da cobrança recém-criada (10 créditos = mês grátis: a
//     cobrança é removida). Exige o evento PAYMENT_CREATED habilitado no painel
//     do ASAAS e o secret ASAAS_API_KEY também nesta função.
//
// verify_jwt = false (config.toml): o ASAAS não manda JWT do Supabase; a segurança
// aqui é o token. Handlers idempotentes: reprocessar o mesmo evento é inofensivo.
//
// Segredos: ASAAS_WEBHOOK_TOKEN (o mesmo do painel) e ASAAS_API_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

// Traduz o pagamento do ASAAS → status que gravamos em profiles.subscription_status.
//  active   → libera o acesso
//  past_due → em atraso (o app trata como inativo → cai no paywall)
//  canceled → sem acesso
//
// Preferimos olhar o STATUS do pagamento (mais confiável que o nome do evento):
// cobre pago normal (RECEIVED/CONFIRMED) e também "receber em dinheiro"
// (RECEIVED_IN_CASH). Como fallback, ainda mapeamos alguns eventos.
const ACTIVE_STATUSES = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'])
const REVOKED_STATUSES = new Set(['REFUNDED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'DELETED'])

function statusFromPayment(payStatus: string, event: string): 'active' | 'past_due' | 'canceled' | null {
  if (ACTIVE_STATUSES.has(payStatus)) return 'active'
  if (payStatus === 'OVERDUE') return 'past_due'
  if (REVOKED_STATUSES.has(payStatus)) return 'canceled'
  // Fallback por nome de evento, caso o status não venha no payload.
  if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') return 'active'
  if (event === 'PAYMENT_OVERDUE') return 'past_due'
  if (event === 'PAYMENT_REFUNDED' || event === 'PAYMENT_DELETED' || event === 'PAYMENT_CHARGEBACK_REQUESTED') return 'canceled'
  return null
}

Deno.serve(async (req) => {
  // Valida o token antes de qualquer coisa.
  const token = req.headers.get('asaas-access-token')
  const expected = Deno.env.get('ASAAS_WEBHOOK_TOKEN')
  if (!expected || token !== expected) {
    return new Response('Token inválido.', { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response('Body inválido.', { status: 400 })
  }

  const event = body.event as string
  const payment = body.payment as Record<string, unknown> | undefined
  const subscription = body.subscription as Record<string, unknown> | undefined

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Localiza o perfil: preferimos o externalReference (que gravamos como o id do
  // usuário na criação da assinatura) e caímos no customer do ASAAS como fallback.
  const userId = (payment?.externalReference as string) || (subscription?.externalReference as string) || ''
  const customerId = (payment?.customer as string) || (subscription?.customer as string) || ''

  const PROFILE_COLS =
    'id, subscription_status, plan_cycle, asaas_subscription_id, referral_credits, referral_discounted_payment_id'

  async function findProfile() {
    if (userId) {
      const { data } = await supabase.from('profiles').select(PROFILE_COLS).eq('id', userId).maybeSingle()
      if (data) return data
    }
    if (customerId) {
      const { data } = await supabase.from('profiles').select(PROFILE_COLS).eq('asaas_customer_id', customerId).maybeSingle()
      if (data) return data
    }
    return null
  }

  async function updateProfile(id: string, fields: Record<string, unknown>) {
    await supabase
      .from('profiles')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
  }

  // Consome créditos de indicação na cobrança de renovação recém-criada.
  // Só para: assinante ativo, plano mensal, cobrança da própria assinatura e
  // ainda não processada (referral_discounted_payment_id ≠ esta cobrança).
  async function applyReferralDiscount(
    profile: Record<string, unknown>,
    pay: Record<string, unknown>,
  ) {
    const credits = (profile.referral_credits as number) || 0
    if (credits <= 0) return
    if (profile.plan_cycle !== 'monthly') return
    // 1ª cobrança (status 'pending') fica de fora: o valor dela já foi tratado
    // na create-subscription e o QR/link foi emitido — mexer aqui geraria corrida.
    if (profile.subscription_status !== 'active') return
    if (!pay.subscription || pay.subscription !== profile.asaas_subscription_id) return
    if (profile.referral_discounted_payment_id === pay.id) return // já processada

    const apiKey = Deno.env.get('ASAAS_API_KEY')
    if (!apiKey) {
      console.warn('ASAAS_API_KEY ausente no webhook; desconto de indicação não aplicado.')
      return
    }

    const base = Number(pay.value) || 0
    let use = Math.min(credits, 10)

    if (use >= 10) {
      // Mês 100% grátis: o ASAAS não aceita cobrança de R$ 0, então removemos a
      // cobrança do ciclo. Gravamos o id ANTES de deletar — o PAYMENT_DELETED
      // que o próprio delete dispara é reconhecido e ignorado lá embaixo. Se o
      // delete falhar, devolvemos os créditos (nenhum PAYMENT_DELETED virá).
      await updateProfile(profile.id as string, {
        referral_credits: credits - 10,
        referral_discounted_payment_id: pay.id,
      })
      try {
        await asaas(`/payments/${pay.id}`, apiKey, { method: 'DELETE' })
        console.log('Indicação: mês grátis aplicado, cobrança removida:', pay.id)
      } catch (e) {
        await updateProfile(profile.id as string, {
          referral_credits: credits,
          referral_discounted_payment_id: null,
        })
        console.error('Indicação: falha ao remover cobrança do mês grátis:', (e as Error).message)
      }
      return
    }

    // Desconto parcial: 10% por crédito, respeitando o valor mínimo de cobrança
    // do ASAAS (R$ 5) — se estourar, consome menos créditos e o resto fica.
    const valueFor = (n: number) => Math.round(base * (1 - n * 0.1) * 100) / 100
    while (use > 0 && valueFor(use) < 5) use--
    if (use <= 0) return

    await asaas(`/payments/${pay.id}`, apiKey, {
      method: 'PUT',
      body: JSON.stringify({
        billingType: pay.billingType || 'CREDIT_CARD',
        value: valueFor(use),
        dueDate: pay.dueDate,
      }),
    })
    await updateProfile(profile.id as string, {
      referral_credits: credits - use,
      referral_discounted_payment_id: pay.id,
    })
    console.log(`Indicação: ${use * 10}% aplicado na cobrança`, pay.id)
  }

  // Log pra facilitar depuração no painel do Supabase.
  console.log('Webhook ASAAS:', event, 'status:', payment?.status, 'user:', userId, 'customer:', customerId)

  try {
    const profile = await findProfile()
    if (!profile) {
      console.warn('Nenhum perfil para user/customer ASAAS:', userId, customerId)
      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (event === 'SUBSCRIPTION_DELETED') {
      await updateProfile(profile.id as string, { subscription_status: 'canceled', asaas_subscription_id: null })
    } else if (event === 'PAYMENT_CREATED' && payment) {
      await applyReferralDiscount(profile, payment)
    } else if (payment) {
      const status = statusFromPayment((payment.status as string) || '', event)
      // Cobrança que NÓS removemos (mês grátis da indicação): o PAYMENT_DELETED
      // resultante não é um cancelamento do assinante — ignora.
      const ourDeletion =
        status === 'canceled' && payment.id === profile.referral_discounted_payment_id
      if (status && !ourDeletion) {
        await updateProfile(profile.id as string, { subscription_status: status })
        // 1º pagamento confirmado de um indicado → credita quem indicou.
        // No-op (false) para quem não foi indicado ou já foi contado.
        if (status === 'active') {
          const { error } = await supabase.rpc('credit_referral', { p_referred: profile.id })
          if (error) console.error('credit_referral falhou:', error.message)
        }
      } else if (!status) {
        console.log('Evento/status ASAAS não tratado:', event, payment.status)
      }
    }
  } catch (err) {
    // Loga mas responde 200: erro transitório não deve travar a fila sequencial.
    console.error('Erro ao processar webhook ASAAS:', (err as Error).message)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
