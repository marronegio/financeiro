import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Aviso diário por e-mail: "vence amanhã".
//
// Roda 1x por dia (via pg_cron — ver supabase/despesa_avisos.sql). Para cada
// usuário, varre os perfis do blob de finanças e encontra as despesas fixas cujo
// vencimento cai AMANHÃ (no fuso de São Paulo), que ainda não foram marcadas como
// pagas naquele ciclo e cujo perfil não desligou os avisos. Manda um e-mail
// resumindo, e registra cada aviso em `despesa_avisos` para nunca repetir.

const TZ = 'America/Sao_Paulo'
const FROM = Deno.env.get('NOTIF_FROM_EMAIL')! // ex.: "DinPrev <avisos@seudominio.com>"
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')!

// Data de hoje no fuso de São Paulo, como partes inteiras (mês 0-based).
function hojeSP(now = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const [y, m, d] = f.format(now).split('-').map(Number)
  return { y, m: m - 1, d }
}

const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

// Dias até o próximo vencimento e o período ('YYYY-MM') dele. null se venc inválido.
function dueInfo(venc: unknown, today: { y: number; m: number; d: number }) {
  const v = parseInt(String(venc), 10)
  if (!v || v < 1 || v > 31) return null

  const { y, m, d } = today
  const dayThis = Math.min(v, lastDay(y, m))
  let dueY = y, dueM = m, dueD = dayThis
  if (d > dayThis) {
    const nm = new Date(Date.UTC(y, m + 1, 1))
    dueY = nm.getUTCFullYear()
    dueM = nm.getUTCMonth()
    dueD = Math.min(v, lastDay(dueY, dueM))
  }
  const days = Math.round((Date.UTC(dueY, dueM, dueD) - Date.UTC(y, m, d)) / 86400000)
  const duePeriod = `${dueY}-${String(dueM + 1).padStart(2, '0')}`
  return { days, duePeriod }
}

// Normaliza o nome para compor a chave anti-duplicado (estável dentro do ciclo).
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase()

function montarEmail(nomes: string[]) {
  const lista = nomes.map((n) => `<li style="margin:4px 0">${n}</li>`).join('')
  const plural = nomes.length > 1
  const subject = plural
    ? `${nomes.length} despesas fixas vencem amanhã`
    : `A despesa fixa "${nomes[0]}" vence amanhã`
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0a2540;max-width:480px">
      <h2 style="font-size:18px;margin:0 0 12px">Lembrete de vencimento</h2>
      <p style="margin:0 0 10px;font-size:15px;line-height:1.5">
        ${plural ? 'Estas despesas fixas vencem' : 'Esta despesa fixa vence'} <b>amanhã</b>:
      </p>
      <ul style="font-size:15px;padding-left:20px;margin:0 0 16px">${lista}</ul>
      <p style="margin:0;font-size:13px;color:#8898aa">
        Você recebe este aviso porque ativou as notificações de vencimento no DinPrev.
        Pode desligá-las em Configurações → Notificações.
      </p>
    </div>`
  return { subject, html }
}

Deno.serve(async (req) => {
  // Só o cron (com o segredo combinado) pode disparar — evita abuso da função pública.
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('forbidden', { status: 403 })
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const today = hojeSP()
  const { data: rows, error } = await admin.from('finances').select('user_id, state')
  if (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  let enviados = 0

  for (const row of rows ?? []) {
    const blob = row.state || {}
    const profiles = blob?.profiles || {}

    // Reúne todas as despesas que vencem amanhã, somando os perfis (Duo).
    const pendentes: { chave: string; nome: string }[] = []
    for (const [pid, prof] of Object.entries<any>(profiles)) {
      const data = prof?.data || {}
      if (data.emailVencimentos === false) continue
      for (const dsp of data.despesas || []) {
        const info = dueInfo(dsp.venc, today)
        if (!info || info.days !== 1) continue
        if (dsp.pago === info.duePeriod) continue
        const nome = String(dsp.nome || '').trim() || 'sem nome'
        pendentes.push({ chave: `${pid}|${norm(nome)}|${info.duePeriod}`, nome })
      }
    }
    if (pendentes.length === 0) continue

    // Tira os que já foram avisados (dedup pela tabela de controle).
    const { data: jaAvisados } = await admin
      .from('despesa_avisos')
      .select('chave')
      .eq('user_id', row.user_id)
      .in('chave', pendentes.map((p) => p.chave))
    const vistos = new Set((jaAvisados ?? []).map((a) => a.chave))
    const novos = pendentes.filter((p) => !vistos.has(p.chave))
    if (novos.length === 0) continue

    // E-mail da conta.
    const { data: userRes } = await admin.auth.admin.getUserById(row.user_id)
    const email = userRes?.user?.email
    if (!email) continue

    const { subject, html } = montarEmail(novos.map((n) => n.nome))
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to: email, subject, html }),
    })

    if (!resp.ok) {
      console.error('Falha ao enviar e-mail:', row.user_id, await resp.text())
      continue // sem gravar: tenta de novo na próxima execução
    }

    await admin.from('despesa_avisos').insert(
      novos.map((n) => ({ user_id: row.user_id, chave: n.chave })),
    )
    enviados += 1
  }

  return new Response(JSON.stringify({ ok: true, enviados }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
