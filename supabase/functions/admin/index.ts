import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PLAN_CONFIG, planKeyOf } from '../_shared/asaasPlans.ts'

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

// Painel administrativo — só o admin (ADMIN_EMAIL) pode chamar.
//
// Fluxo de segurança em duas camadas:
//   1) verify_jwt = true (config.toml): a plataforma já exige um JWT válido.
//   2) Aqui, conferimos que o e-mail do chamador está em ADMIN_EMAIL. Só então
//      usamos o service_role para ler/escrever qualquer perfil.
// Sem a checagem (2), qualquer usuário logado poderia mexer nos dados dos outros.
//
// Configure os admins (um ou vários, separados por vírgula):
//   supabase secrets set ADMIN_EMAIL="voce@exemplo.com"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const currentMonth = () => new Date().toISOString().slice(0, 7) // 'YYYY-MM'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1) Autentica o chamador pelo JWT.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Não autorizado.' }, 401)

    const asUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: userError } = await asUser.auth.getUser()
    if (userError || !user) return json({ error: 'Não autorizado.' }, 401)

    // 2) Confere que é admin. Lista de e-mails no secret ADMIN_EMAIL.
    const admins = (Deno.env.get('ADMIN_EMAIL') || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
    if (!admins.includes((user.email || '').toLowerCase())) {
      return json({ error: 'Acesso restrito.' }, 403)
    }

    // A partir daqui, service_role: sem RLS, mexe em qualquer perfil.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { action, userId, value, enabled, plan, apply } = await req.json().catch(() => ({}))

    switch (action) {
      // Lista todos os usuários (perfil + e-mail + consumo de IA do mês).
      case 'list': {
        // Perfis (dados de assinatura/IA).
        const { data: profiles, error: pErr } = await admin
          .from('profiles')
          .select('id, subscription_status, plan, plan_cycle, payment_provider, access_until, admin_override, ai_enabled, updated_at')
        if (pErr) throw pErr

        // Consumo de IA do mês atual, por usuário.
        const month = currentMonth()
        const { data: usage } = await admin
          .from('ai_usage')
          .select('user_id, credits')
          .eq('month', month)
        const usageBy = new Map((usage || []).map((u) => [u.user_id, u.credits]))

        // E-mails vivem em auth.users — buscamos via Admin API (paginado).
        const emailBy = new Map<string, { email: string | null; createdAt: string; lastSignIn: string | null }>()
        for (let page = 1; page <= 100; page++) {
          const { data: list, error: lErr } = await admin.auth.admin.listUsers({ page, perPage: 200 })
          if (lErr) throw lErr
          for (const u of list.users) {
            emailBy.set(u.id, {
              email: u.email ?? null,
              createdAt: u.created_at,
              lastSignIn: u.last_sign_in_at ?? null,
            })
          }
          if (list.users.length < 200) break
        }

        const profileBy = new Map((profiles || []).map((p) => [p.id, p]))
        // Une por usuário do Auth (garante que apareça mesmo quem ainda não tem perfil).
        const users = [...emailBy.entries()].map(([id, info]) => {
          const p = profileBy.get(id) || {}
          return {
            id,
            email: info.email,
            createdAt: info.createdAt,
            lastSignIn: info.lastSignIn,
            subscriptionStatus: p.subscription_status ?? 'inactive',
            plan: p.plan ?? 'solo',
            planCycle: p.plan_cycle ?? null,
            provider: p.payment_provider ?? null,
            accessUntil: p.access_until ?? null,
            adminOverride: p.admin_override ?? null,
            aiEnabled: p.ai_enabled !== false,
            aiCreditsUsed: usageBy.get(id) ?? 0,
          }
        })
        // Mais recentes primeiro.
        users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        return json({ users, month })
      }

      // Cortesia/bloqueio manual de acesso (ignora o gateway). value: 'active'|'inactive'|null
      case 'set_subscription': {
        if (!userId) return json({ error: 'userId obrigatório.' }, 400)
        const ov = value === 'active' || value === 'inactive' ? value : null
        // Upsert: contas que nunca pagaram ainda não têm linha em profiles —
        // um UPDATE alteraria 0 linhas e falharia em silêncio.
        const { error } = await admin
          .from('profiles')
          .upsert({ id: userId, admin_override: ov, updated_at: new Date().toISOString() })
        if (error) throw error
        return json({ ok: true })
      }

      // Liga/desliga o assistente de IA.
      case 'set_ai': {
        if (!userId) return json({ error: 'userId obrigatório.' }, 400)
        const { error } = await admin
          .from('profiles')
          .update({ ai_enabled: !!enabled, updated_at: new Date().toISOString() })
          .eq('id', userId)
        if (error) throw error
        return json({ ok: true })
      }

      // Troca o plano/tier (free/solo/duo). 'free' é o tier sem assinatura —
      // ortogonal ao set_subscription, que controla o acesso em si.
      case 'set_plan': {
        if (!userId) return json({ error: 'userId obrigatório.' }, 400)
        if (!['free', 'solo', 'duo'].includes(plan)) {
          return json({ error: 'plan deve ser free, solo ou duo.' }, 400)
        }
        // Upsert pelo mesmo motivo do set_subscription: quem nunca pagou pode
        // ainda não ter linha em profiles, e um UPDATE falharia em silêncio.
        const { error } = await admin
          .from('profiles')
          .upsert({ id: userId, plan, updated_at: new Date().toISOString() })
        if (error) throw error
        return json({ ok: true })
      }

      // Realinha o valor das assinaturas JÁ existentes no ASAAS com a tabela de
      // preços atual (_shared/asaasPlans.ts). Sem isso, baixar um preço só vale
      // para quem assina depois — quem já assina segue pagando o valor gravado
      // na assinatura lá.
      //
      // `apply` ausente/false = só confere e devolve o que MUDARIA. Nada é
      // escrito sem apply === true: isto mexe em cobrança de gente real.
      case 'asaas_price_sync': {
        const apiKey = Deno.env.get('ASAAS_API_KEY')
        if (!apiKey) return json({ error: 'ASAAS_API_KEY não configurada.' }, 500)

        const { data: profiles, error: pErr } = await admin
          .from('profiles')
          .select('id, plan, plan_cycle, subscription_status, asaas_subscription_id')
          .not('asaas_subscription_id', 'is', null)
        if (pErr) throw pErr

        // E-mails para o relatório ficar legível no painel.
        const emailBy = new Map<string, string | null>()
        for (let page = 1; page <= 100; page++) {
          const { data: list, error: lErr } = await admin.auth.admin.listUsers({ page, perPage: 200 })
          if (lErr) throw lErr
          for (const u of list.users) emailBy.set(u.id, u.email ?? null)
          if (list.users.length < 200) break
        }

        const rows: Record<string, unknown>[] = []
        for (const p of profiles || []) {
          const key = planKeyOf(p.plan, p.plan_cycle)
          const target = key ? PLAN_CONFIG[key] : null
          const row: Record<string, unknown> = {
            userId: p.id,
            email: emailBy.get(p.id) ?? null,
            planKey: key,
            status: p.subscription_status,
            subscriptionId: p.asaas_subscription_id,
            targetValue: target?.value ?? null,
            currentValue: null as number | null,
            changed: false,
            skipped: null as string | null,
          }

          if (!target) {
            // plan 'free' ou desconhecido: não há preço de tabela a aplicar.
            row.skipped = 'sem plano pago'
            rows.push(row)
            continue
          }

          try {
            const sub = await asaas(`/subscriptions/${p.asaas_subscription_id}`, apiKey)
            row.currentValue = typeof sub?.value === 'number' ? sub.value : null
            // Assinatura já encerrada no ASAAS não deve ser mexida.
            if (sub?.status && sub.status !== 'ACTIVE') {
              row.skipped = `assinatura ${sub.status} no ASAAS`
              rows.push(row)
              continue
            }
            if (row.currentValue === target.value) {
              row.skipped = 'já está no preço'
              rows.push(row)
              continue
            }
            if (apply === true) {
              await asaas(`/subscriptions/${p.asaas_subscription_id}`, apiKey, {
                method: 'PUT',
                body: JSON.stringify({
                  value: target.value,
                  // Sem isto, cobranças já geradas e ainda em aberto seguiriam
                  // com o valor antigo.
                  updatePendingPayments: true,
                }),
              })
              row.changed = true
            }
          } catch (e) {
            row.skipped = `erro: ${(e as Error).message}`
          }
          rows.push(row)
        }

        const pendentes = rows.filter((r) => !r.skipped && !r.changed).length
        const alteradas = rows.filter((r) => r.changed).length
        return json({
          applied: apply === true,
          total: rows.length,
          pendentes, // divergem do preço de tabela (quando apply = false)
          alteradas,
          rows,
        })
      }

      // Zera os créditos de IA do mês atual (devolve o saldo cheio).
      case 'reset_ai': {
        if (!userId) return json({ error: 'userId obrigatório.' }, 400)
        const { error } = await admin
          .from('ai_usage')
          .delete()
          .eq('user_id', userId)
          .eq('month', currentMonth())
        if (error) throw error
        return json({ ok: true })
      }

      // Exclusão definitiva da conta (dados + usuário no Auth). Irreversível.
      case 'delete_user': {
        if (!userId) return json({ error: 'userId obrigatório.' }, 400)
        if (userId === user.id) return json({ error: 'Você não pode excluir a própria conta pelo painel.' }, 400)
        await admin.from('finances').delete().eq('user_id', userId)
        await admin.from('profiles').delete().eq('id', userId)
        const { error } = await admin.auth.admin.deleteUser(userId)
        if (error) throw error
        return json({ ok: true })
      }

      default:
        return json({ error: 'Ação desconhecida.' }, 400)
    }
  } catch (err) {
    console.error('admin function:', err)
    return json({ error: (err as Error).message }, 500)
  }
})
