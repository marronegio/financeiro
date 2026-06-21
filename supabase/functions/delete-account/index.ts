import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Exclusão definitiva de conta (LGPD): apaga os dados no Stripe (cliente +
// assinaturas), os dados da aplicação e o usuário no Auth. Irreversível.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Autentica o usuário pelo JWT — só a própria pessoa pode excluir a conta.
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

    // Service role para apagar dados sem RLS e remover o usuário do Auth.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1) Stripe: apagar o cliente cancela as assinaturas e remove os dados
    //    pessoais lá também. Erros aqui não bloqueiam a exclusão da conta.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profile?.stripe_customer_id) {
      try {
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
          apiVersion: '2024-06-20',
          httpClient: Stripe.createFetchHttpClient(),
        })
        await stripe.customers.del(profile.stripe_customer_id)
      } catch (err) {
        console.warn('Falha ao apagar cliente no Stripe (seguindo):', err.message)
      }
    }

    // 2) Dados da aplicação. O cascade de auth.users também cobriria, mas
    //    apagamos explicitamente para garantir e deixar a intenção clara.
    await supabaseAdmin.from('finances').delete().eq('user_id', user.id)
    await supabaseAdmin.from('profiles').delete().eq('id', user.id)

    // 3) Usuário no Auth. (trial_redemptions é mantido de propósito: é um
    //    registro antiabuso por CPF, sem dado financeiro, que impede pegar o
    //    teste grátis de novo recriando a conta com outro e-mail.)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ ok: true }), {
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
