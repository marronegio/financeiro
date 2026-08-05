// Resumo mensal em PDF, enviado por e-mail.
//
// O app abre o resumo de um mês fechado num popup; quem quiser guardar (ou
// mandar pro contador, pro parceiro, pro banco) pede o PDF por ali. Esta função
// monta o arquivo e envia como anexo pelo Resend.
//
// O DESTINATÁRIO NUNCA VEM DO CLIENTE: é sempre o e-mail da conta autenticada,
// lido aqui pelo service_role. Assim ninguém usa a função para mandar e-mail
// para terceiros. O conteúdo do resumo vem do app (é o mesmo que a pessoa está
// vendo na tela, inclusive um mês recém-fechado que ainda não terminou de
// sincronizar) — no pior caso alguém gera um PDF errado para a própria caixa.
//
// verify_jwt = true (config.toml): só usuário logado chega aqui. O histórico é
// recurso do Pro, então o plano também é conferido.
//
// Secrets usados (os mesmos do aviso de vencimento):
//   supabase secrets set RESEND_API_KEY=... NOTIF_FROM_EMAIL="DinPrev <avisos@seudominio.com>"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'
import { hasPaidAccess, userIdFromRequest } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FROM = Deno.env.get('NOTIF_FROM_EMAIL')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

// Tetos defensivos: o corpo vem do cliente, então nada de PDF infinito.
const MAX_GRUPOS = 12
const MAX_ITENS = 300
const MAX_TEXTO = 70

type Item = { nome?: string; valor?: number; catLabel?: string; tag?: string }
type Grupo = { label?: string; total?: number; itens?: Item[] }
type Resumo = {
  salario?: number
  rendaExtra?: number
  ganhos?: number
  gasto?: number
  guardado?: number
  meta?: number
  cartao?: number
  grupos?: Grupo[]
  abates?: Grupo | null
  rendaExtraItens?: Item[]
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const fmtPeriodo = (p: string) => {
  const [y, m] = p.split('-').map(Number)
  return `${MESES[m - 1]} de ${y}`
}

const num = (v: unknown) => {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

function brl(v: unknown) {
  const n = num(v)
  const [int, dec] = Math.abs(n).toFixed(2).split('.')
  return `${n < 0 ? '-' : ''}R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`
}

// As fontes padrão do PDF usam WinAnsi (Latin-1): acento passa, emoji não.
// Troca a pontuação "bonitinha" por ASCII e descarta o que sobrar de fora.
function san(v: unknown, max = MAX_TEXTO) {
  const s = String(v ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[ \t\r\n]/g, ' ')
    .split('')
    .filter((ch) => {
      const c = ch.charCodeAt(0)
      return (c >= 32 && c <= 126) || (c >= 160 && c <= 255)
    })
    .join('')
    .trim()
  return s.length > max ? s.slice(0, max - 1) + '.' : s
}

const itens = (arr: unknown): Item[] =>
  (Array.isArray(arr) ? arr : []).slice(0, MAX_ITENS).map((it: Item) => ({
    nome: san(it?.nome) || 'Sem nome',
    valor: num(it?.valor),
    catLabel: it?.catLabel ? san(it.catLabel, 24) : '',
    tag: it?.tag ? san(it.tag, 24) : '',
  }))

const grupos = (arr: unknown): Grupo[] =>
  (Array.isArray(arr) ? arr : []).slice(0, MAX_GRUPOS).map((g: Grupo) => ({
    label: san(g?.label, 40) || 'Gastos',
    total: num(g?.total),
    itens: itens(g?.itens),
  }))

async function montarPdf(periodo: string, r: Resumo): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const W = 595.28
  const H = 841.89
  const M = 52
  const RIGHT = W - M

  const ink = rgb(0.04, 0.15, 0.25)
  const muted = rgb(0.53, 0.6, 0.67)
  const line = rgb(0.88, 0.9, 0.92)
  const green = rgb(0.05, 0.62, 0.43)
  const red = rgb(0.88, 0.34, 0.3)

  let page = doc.addPage([W, H])
  let y = H - M

  const novaPagina = () => {
    page = doc.addPage([W, H])
    y = H - M
  }
  // Quebra a página quando o próximo bloco não cabe mais.
  const cabe = (h: number) => {
    if (y - h < M) novaPagina()
  }

  const escrever = (
    txt: string,
    x: number,
    size: number,
    color = ink,
    f = font,
  ) => page.drawText(txt, { x, y, size, font: f, color })

  const direita = (txt: string, size: number, color = ink, f = font) =>
    page.drawText(txt, { x: RIGHT - f.widthOfTextAtSize(txt, size), y, size, font: f, color })

  const regua = (dy = 8) => {
    y -= dy
    page.drawLine({
      start: { x: M, y },
      end: { x: RIGHT, y },
      thickness: 0.7,
      color: line,
    })
    y -= dy + 4
  }

  // ── Cabeçalho ───────────────────────────────────────────────────────────
  escrever('DINPREV', M, 9, muted, bold)
  y -= 22
  escrever(`Resumo de ${san(fmtPeriodo(periodo), 40)}`, M, 22, ink, bold)
  y -= 16
  escrever('Valores conforme o fechamento do ciclo.', M, 9.5, muted)
  y -= 6
  regua()

  // ── Os três números ─────────────────────────────────────────────────────
  const kpi = (rotulo: string, valor: number, cor = ink) => {
    cabe(34)
    escrever(rotulo.toUpperCase(), M, 8.5, muted, bold)
    direita(brl(valor), 15, cor, bold)
    y -= 26
  }
  kpi('Quanto ganhou', num(r.ganhos))
  kpi('Quanto gastou', num(r.gasto), red)
  kpi('Quanto guardou', num(r.guardado), num(r.guardado) >= 0 ? green : red)
  regua()

  // ── Linhas do fechamento ────────────────────────────────────────────────
  const linha = (rotulo: string, valor: number, f = font) => {
    cabe(20)
    escrever(san(rotulo, 48), M, 10.5, f === bold ? ink : muted, f)
    direita(brl(valor), 10.5, ink, f)
    y -= 17
  }

  escrever('COMO O MES FECHOU', M, 8.5, muted, bold)
  y -= 16
  linha('Salário', num(r.salario))
  if (num(r.rendaExtra) > 0) linha('Renda extra', num(r.rendaExtra))
  linha('Total de gastos', num(r.gasto))
  if (num(r.cartao) > 0) linha('Fatura do cartão', num(r.cartao))
  if (num(r.meta) > 0) linha('Meta de economia', num(r.meta))
  linha('Guardado', num(r.guardado), bold)
  regua()

  // ── Grupos de lançamentos ───────────────────────────────────────────────
  const bloco = (g: Grupo) => {
    cabe(46)
    escrever(String(g.label).toUpperCase(), M, 8.5, muted, bold)
    direita(brl(g.total), 10.5, ink, bold)
    y -= 16

    if (!g.itens?.length) {
      escrever('Sem itens detalhados neste grupo.', M, 9.5, muted)
      y -= 16
    } else {
      for (const it of g.itens) {
        cabe(18)
        const etiqueta = [it.catLabel, it.tag].filter(Boolean).join(' · ')
        escrever(String(it.nome), M, 10, ink)
        if (etiqueta) {
          const dx = font.widthOfTextAtSize(String(it.nome), 10) + 8
          escrever(san(etiqueta, 30), M + dx, 8.5, muted)
        }
        direita(brl(it.valor), 10, ink)
        y -= 15
      }
    }
    regua()
  }

  const extras = itens(r.rendaExtraItens)
  if (extras.length) bloco({ label: 'Renda extra', total: num(r.rendaExtra), itens: extras })
  for (const g of grupos(r.grupos)) bloco(g)
  if (r.abates) {
    const a = grupos([r.abates])[0]
    if (a.total || a.itens?.length) bloco(a)
  }

  // ── Rodapé ──────────────────────────────────────────────────────────────
  cabe(30)
  const hoje = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  escrever(`Gerado pelo DinPrev em ${hoje}.`, M, 8.5, muted)

  return await doc.save()
}

function toBase64(bytes: Uint8Array) {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
  const fail = (status: number, error: string, message?: string) =>
    new Response(JSON.stringify({ error, message: message || error }), { status, headers: jsonHeaders })

  try {
    if (!RESEND_API_KEY || !FROM) {
      return fail(500, 'email_indisponivel', 'O envio de e-mails não está configurado.')
    }

    const userId = userIdFromRequest(req)
    if (!userId) return fail(401, 'unauthorized', 'Sessão inválida.')

    const { periodo = '', resumo = {} } = await req.json()
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(periodo))) {
      return fail(400, 'periodo_invalido', 'Mês inválido.')
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // O histórico (e portanto o relatório) é do plano Pro.
    const { data: profile } = await admin
      .from('profiles')
      .select('plan, subscription_status, access_until, admin_override')
      .eq('id', userId)
      .maybeSingle()
    if (!hasPaidAccess(profile) || profile?.plan === 'free') {
      return fail(402, 'upgrade_required', 'O resumo em PDF faz parte do plano Pro.')
    }

    const { data: userRes } = await admin.auth.admin.getUserById(userId)
    const email = userRes?.user?.email
    if (!email) return fail(400, 'sem_email', 'Sua conta não tem um e-mail para receber o PDF.')

    const pdf = await montarPdf(String(periodo), resumo as Resumo)
    const mes = fmtPeriodo(String(periodo))

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: email,
        subject: `Seu resumo de ${mes} — DinPrev`,
        html: `
          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0a2540;max-width:480px">
            <h2 style="font-size:18px;margin:0 0 12px">Resumo de ${mes}</h2>
            <p style="margin:0 0 10px;font-size:15px;line-height:1.5">
              O PDF em anexo traz tudo o que você viu no app: quanto entrou, quanto saiu,
              quanto você guardou e cada gasto do mês com sua categoria.
            </p>
            <p style="margin:0;font-size:13px;color:#8898aa">
              Você recebeu este e-mail porque pediu o resumo em PDF dentro do DinPrev.
            </p>
          </div>`,
        attachments: [
          { filename: `dinprev-resumo-${periodo}.pdf`, content: toBase64(pdf) },
        ],
      }),
    })

    if (!resp.ok) {
      console.error('Falha ao enviar o resumo:', userId, await resp.text())
      return fail(502, 'envio_falhou', 'Não conseguimos enviar o e-mail agora. Tente de novo em instantes.')
    }

    return new Response(JSON.stringify({ ok: true, email }), { headers: jsonHeaders })
  } catch (err) {
    console.error('month-report:', err)
    return fail(500, 'erro_interno', 'Não foi possível gerar o PDF agora.')
  }
})
