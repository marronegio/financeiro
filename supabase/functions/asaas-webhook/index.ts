// Webhook do ASAAS — sincroniza o pagamento com o acesso do usuário.
//
// O ASAAS chama esta função a cada evento e envia, no header `asaas-access-token`,
// o token que você configurou no painel. Validamos esse token (o ASAAS não assina
// os eventos como o Stripe). Depois, traduzimos o evento para o mesmo
// profiles.subscription_status que o resto do app já entende — então o gate de
// acesso (useSubscription) não muda nada.
//
// verify_jwt = false (config.toml): o ASAAS não manda JWT do Supabase; a segurança
// aqui é o token. Handlers idempotentes: reprocessar o mesmo evento é inofensivo.
//
// Segredo necessário: ASAAS_WEBHOOK_TOKEN (o mesmo valor colado no painel do ASAAS).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

  async function updateProfile(fields: Record<string, unknown>) {
    let profile: { id: string } | null = null
    if (userId) {
      const { data } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle()
      profile = data
    }
    if (!profile && customerId) {
      const { data } = await supabase.from('profiles').select('id').eq('asaas_customer_id', customerId).maybeSingle()
      profile = data
    }
    if (!profile) {
      console.warn('Nenhum perfil para user/customer ASAAS:', userId, customerId)
      return
    }
    await supabase
      .from('profiles')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', profile.id)
  }

  // Log pra facilitar depuração no painel do Supabase.
  console.log('Webhook ASAAS:', event, 'status:', payment?.status, 'user:', userId, 'customer:', customerId)

  try {
    if (event === 'SUBSCRIPTION_DELETED') {
      await updateProfile({ subscription_status: 'canceled', asaas_subscription_id: null })
    } else if (payment) {
      const status = statusFromPayment((payment.status as string) || '', event)
      if (status) await updateProfile({ subscription_status: status })
      else console.log('Evento/status ASAAS não tratado:', event, payment.status)
    }
  } catch (err) {
    // Loga mas responde 200: erro transitório não deve travar a fila sequencial.
    console.error('Erro ao processar webhook ASAAS:', (err as Error).message)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
