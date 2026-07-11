// DESATIVADA — o Stripe deixou de ser aceito para novas assinaturas; o checkout
// agora é exclusivamente pelo ASAAS (asaas-create-subscription).
//
// A função continua publicada apenas para que versões antigas do app recebam
// um erro claro em vez de um 404 genérico. Assinantes que já estão ativos no
// Stripe seguem atendidos por stripe-webhook, customer-portal e
// cancel-subscription — nada disso passa por aqui.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({
      error: 'Pagamentos pelo cartão via Stripe foram descontinuados. Atualize o aplicativo para assinar.',
    }),
    {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
})
