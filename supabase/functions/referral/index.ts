// Programa de indicação — dados do usuário logado para o card "Indique e ganhe".
//
// Devolve { code, total, credits, discountNextPct }:
//   * code — código de indicação do usuário (gera na primeira chamada);
//   * total — indicações confirmadas (1º pagamento do indicado recebido);
//   * credits — créditos de 10% acumulados e ainda não consumidos;
//   * discountNextPct — desconto que será aplicado na próxima mensalidade.
//
// A escrita fica toda aqui (service role): o frontend nunca grava em profiles.
// verify_jwt = true (config.toml): exige usuário logado.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Sem 0/O/1/I para o código ser fácil de ditar e digitar no celular.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomCode(len = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  let out = ''
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return out
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
      .select('referral_code, referral_credits, referral_total')
      .eq('id', user.id)
      .maybeSingle()

    let code = profile?.referral_code || ''

    // Primeira visita ao card: gera o código. Upsert porque contas que nunca
    // pagaram ainda não têm linha em profiles. Colisão do UNIQUE → tenta outro.
    if (!code) {
      for (let attempt = 0; attempt < 5 && !code; attempt++) {
        const candidate = randomCode()
        const { error } = await supabaseAdmin
          .from('profiles')
          .upsert({ id: user.id, referral_code: candidate, updated_at: new Date().toISOString() })
        if (!error) code = candidate
        else if (!/duplicate|unique/i.test(error.message)) throw new Error(error.message)
      }
      if (!code) return json({ error: 'Não foi possível gerar o código. Tente novamente.' }, 500)
    }

    const credits = profile?.referral_credits ?? 0
    return json({
      code,
      total: profile?.referral_total ?? 0,
      credits,
      discountNextPct: Math.min(credits, 10) * 10,
    })
  } catch (err) {
    console.error(err)
    return json({ error: (err as Error).message }, 500)
  }
})
