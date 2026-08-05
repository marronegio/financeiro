// Layout compartilhado dos e-mails transacionais (aviso de vencimento, resumo
// mensal). Cada função continua dona do CONTEÚDO (o que dizer); aqui fica só a
// casca visual, para as duas terem a cara do DinPrev e mudar de estilo num
// lugar só.
//
// Regras de e-mail HTML (motivo de cada escolha estranha aqui):
//  - Tabelas, não flex/grid: é o único layout que Outlook desktop (motor Word)
//    renderiza direito.
//  - `bgcolor` como atributo, não só CSS: clientes antigos (e o Gmail em app)
//    ignoram `background` em alguns contextos, mas sempre respeitam o atributo.
//  - Cores em hex sólido, nunca rgba(): suporte inconsistente em Outlook.
//  - Nada de dark mode automático: o app tem tema escuro, mas o e-mail força
//    claro sempre — Gmail/Apple Mail reinvertem cor por conta própria e
//    quebram o vermelho/verde que carregam significado (gasto vs. guardado).
//  - Fonte da marca (Hanken Grotesk) como reforço progressivo: quem suporta
//    mostra; quem não, cai no system-ui do stack — nunca texto sem fonte.

const SITE_URL = 'https://dinprev.com.br'

const c = {
  bg: '#eef2f8',
  surface: '#ffffff',
  ink: '#0a2540',
  muted: '#425466',
  faint: '#8898aa',
  line: '#e6ebf1',
  accent: '#635bff',
  accentSoft: '#f0eeff',
  accentLine: '#dcd9ff',
  positive: '#0e9f6e',
  positiveSoft: '#e9f9f3',
  negative: '#e0564c',
  negativeSoft: '#fdedec',
}

const FONT_STACK =
  "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const MONO_STACK = "'IBM Plex Mono', 'SFMono-Regular', Consolas, Menlo, monospace"

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch] as string))

// Texto de pré-visualização (o trecho que Gmail/Apple Mail mostram ao lado do
// assunto, antes de abrir). Fica invisível no corpo, preenchido com espaços de
// largura zero para não sobrar lixo do resto do e-mail nessa prévia.
function preheader(text: string) {
  const pad = '&nbsp;&zwnj;'.repeat(80)
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(text)}${pad}</div>`
}

// Botão "bulletproof": célula de tabela com bgcolor (não só CSS) por baixo do
// link, então continua sólido até no Outlook mais antigo.
export function emailButton(href: string, label: string) {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 0">
    <tr>
      <td bgcolor="${c.accent}" style="border-radius:9px;">
        <a href="${esc(href)}" style="display:inline-block;padding:12px 22px;font-family:${FONT_STACK};font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:9px;">
          ${esc(label)}
        </a>
      </td>
    </tr>
  </table>`
}

export type Kpi = { label: string; value: string; tone?: 'pos' | 'neg' | 'ink' }

// As três estatísticas do mês lado a lado (ganhou / gastou / guardou), o mesmo
// resumo de três números que o popup do app mostra no topo.
export function emailKpis(items: Kpi[]) {
  const toneColor = (t?: Kpi['tone']) => (t === 'pos' ? c.positive : t === 'neg' ? c.negative : c.ink)
  // toLocaleString('pt-BR', {style:'currency'}) separa "R$" do valor com um
  // espaço NÃO quebrável (U+00A0). Em 3 colunas de ~80px isso vira um bloco
  // maior que a própria coluna e estoura a tabela inteira. Espaço normal deixa
  // "R$" quebrar para a linha de cima em telas bem estreitas, em vez de
  // forçar todo o e-mail para os lados.
  const wrap = (v: string) => v.split(String.fromCharCode(160)).join(' ')
  const cells = items
    .map(
      (k) => `
      <td width="${Math.floor(100 / items.length)}%" style="padding:0 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td bgcolor="${c.bg}" style="border-radius:10px;padding:12px 2px;text-align:center;">
            <div style="font-family:${FONT_STACK};font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${c.faint};margin:0 0 4px;">${esc(k.label)}</div>
            <div style="font-family:${MONO_STACK};font-size:14px;font-weight:600;color:${toneColor(k.tone)};">${esc(wrap(k.value))}</div>
          </td></tr>
        </table>
      </td>`
    )
    .join('')
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0;">
    <tr>${cells}</tr>
  </table>`
}

// Uma linha "nome — valor", usada tanto na lista de vencimentos quanto nos
// itens do resumo mensal. `tag` é a etiqueta opcional (categoria, "4/12"...).
export function emailRow(nome: string, valor: string, tag?: string) {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="padding:9px 0;border-top:1px solid ${c.line};font-family:${FONT_STACK};font-size:14px;color:${c.ink};">
        ${esc(nome)}
        ${tag ? `<span style="font-family:${FONT_STACK};font-size:11px;font-weight:600;color:${c.faint};border:1px solid ${c.line};border-radius:999px;padding:2px 8px;margin-left:6px;white-space:nowrap;">${esc(tag)}</span>` : ''}
      </td>
      <td align="right" style="padding:9px 0;border-top:1px solid ${c.line};font-family:${MONO_STACK};font-size:14px;font-weight:600;color:${c.ink};white-space:nowrap;">
        ${esc(valor)}
      </td>
    </tr>
  </table>`
}

// Selo colorido pequeno (ex.: "vence amanhã"). `tone` decide a cor.
export function emailBadge(text: string, tone: 'pos' | 'neg' = 'neg') {
  const bg = tone === 'neg' ? c.negativeSoft : c.positiveSoft
  const fg = tone === 'neg' ? c.negative : c.positive
  return `<span style="display:inline-block;font-family:${FONT_STACK};font-size:11px;font-weight:700;color:${fg};background:${bg};border-radius:999px;padding:3px 10px;">${esc(text)}</span>`
}

// A casca completa: cabeçalho com a marca, o cartão branco com o conteúdo, e o
// rodapé. `contentHtml` é montado por quem chama (já pode usar os helpers
// acima) — aqui só entra dentro do cartão.
export function emailLayout(opts: {
  preheaderText: string
  title: string
  contentHtml: string
  footerNote: string
}) {
  const year = new Date().getFullYear()
  return `<!doctype html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(opts.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600;700&family=IBM+Plex+Mono:wght@600&display=swap" rel="stylesheet" />
<style>
  body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { border:0; line-height:100%; outline:none; text-decoration:none; }
  body { margin:0; padding:0; width:100% !important; background:${c.bg}; }
  a { color:${c.accent}; }
  @media (max-width: 600px) {
    .dp-pad { padding-left:20px !important; padding-right:20px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${c.bg};">
${preheader(opts.preheaderText)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.bg}">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="dp-container" style="width:100%;max-width:600px;">

        <!-- marca -->
        <tr>
          <td class="dp-pad" style="padding:0 8px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-right:8px;"><img src="${SITE_URL}/logo.png" width="26" height="26" alt="" style="display:block;border-radius:6px;" /></td>
                <td style="font-family:${FONT_STACK};font-size:16px;font-weight:700;color:${c.ink};letter-spacing:-.01em;">DinPrev</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- cartão -->
        <tr>
          <td>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.surface}" style="border-radius:16px;border:1px solid ${c.line};">
              <tr>
                <td class="dp-pad" style="padding:30px 32px;">
                  <div style="font-family:${FONT_STACK};font-size:20px;font-weight:700;color:${c.ink};letter-spacing:-.01em;margin:0 0 16px;">
                    ${esc(opts.title)}
                  </div>
                  ${opts.contentHtml}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- rodapé -->
        <tr>
          <td class="dp-pad" style="padding:22px 8px 0;">
            <p style="margin:0 0 4px;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${c.faint};">
              ${opts.footerNote}
            </p>
            <p style="margin:0;font-family:${FONT_STACK};font-size:12px;color:${c.faint};">
              © ${year} DinPrev · <a href="${SITE_URL}" style="color:${c.faint};text-decoration:underline;">dinprev.com.br</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}
