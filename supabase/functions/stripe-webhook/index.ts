import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Price IDs do plano Duo — usados para gravar o tier ('solo'/'duo') em profiles.
const DUO_PRICE_IDS = new Set(
  [Deno.env.get('STRIPE_PRICE_ID_DUO'), Deno.env.get('STRIPE_PRICE_ID_DUO_ANNUAL')]
    .filter(Boolean) as string[]
)

function planFromSubscription(sub: Stripe.Subscription): 'solo' | 'duo' {
  const priceId = sub.items?.data?.[0]?.price?.id
  return priceId && DUO_PRICE_IDS.has(priceId) ? 'duo' : 'solo'
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  if (!signature) {
    return new Response('Assinatura ausente.', { status: 400 })
  }

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  })

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )
  } catch (err) {
    console.error('Webhook signature inválida:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  async function updateByCustomer(customerId: string, fields: Record<string, unknown>) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single()

    if (!profile) {
      console.warn('Nenhum perfil encontrado para customer:', customerId)
      return
    }

    await supabase
      .from('profiles')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', profile.id)
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.CheckoutSession
      await updateByCustomer(session.customer as string, {
        subscription_id: session.subscription,
        subscription_status: 'active',
      })
      break
    }

    case 'customer.subscription.created': {
      const sub = event.data.object as Stripe.Subscription
      await updateByCustomer(sub.customer as string, {
        subscription_status: sub.status,
        subscription_id: sub.id,
        plan: planFromSubscription(sub),
      })
      // Marca o CPF como tendo usado o teste grátis — não pode repetir, mesmo
      // que a pessoa crie outro e-mail. O CPF vem de profiles (gravado no checkout).
      if (sub.trial_end) {
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('cpf')
            .eq('stripe_customer_id', sub.customer as string)
            .single()
          const cpf = prof?.cpf
          if (cpf) {
            await supabase
              .from('trial_redemptions')
              .upsert({ cpf }, { onConflict: 'cpf' })
          }
        } catch (e) {
          console.warn('Falha ao registrar trial por CPF:', e.message)
        }
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      await updateByCustomer(sub.customer as string, {
        subscription_status: sub.status,
        plan: planFromSubscription(sub),
      })
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await updateByCustomer(sub.customer as string, {
        subscription_status: 'canceled',
        subscription_id: null,
      })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      await updateByCustomer(invoice.customer as string, {
        subscription_status: 'past_due',
      })
      break
    }

    default:
      console.log('Evento não tratado:', event.type)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
