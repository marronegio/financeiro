# Convenções do DinPrev

DinPrev é um app de finanças pessoais em **português (pt-BR)**. Todo conteúdo de UI (labels, hints, botões) é escrito em pt-BR e valores monetários usam o formato brasileiro.

## Setup

Nenhum provider é necessário — os componentes renderizam standalone. O tema é controlado pelo atributo `data-theme` no `<html>`: ausente = claro, `data-theme="dark"` = escuro. Os tokens mudam sozinhos; nunca escreva cores fixas para estados de tema.

Modais (`ConfirmDialog`, `PinDialog`) e os toasts de `DespesaAlerts` usam `position: fixed` e cobrem a viewport — renderize-os condicionalmente no topo da tela, não dentro de containers com `transform`/`overflow`.

## Idioma de estilo

Estilo é feito com **classes CSS globais + CSS custom properties** — não há utility framework nem styled-components. Para o seu próprio layout de cola, use as classes e tokens existentes:

| Uso | Nomes reais |
|---|---|
| Container padrão | `.card`, `.card-head`, `.card-title`, `.card-total`, `.card-link` |
| Texto de apoio | `.hint` |
| Campos | `.field`, `.field-label` |
| Botões | `.ob-next` (primário), `.ob-skip` (secundário), `.btn-danger`, `.add-btn`, `.card-link` |
| Segmented control | `.seg` (botões internos com `.active`) |
| Cores de superfície/texto | `var(--bg)`, `var(--surface)`, `var(--ink)`, `var(--muted)`, `var(--line)`, `var(--line-strong)` |
| Cor de marca | `var(--accent)`, `var(--accent-soft)` |
| Semântica financeira | `var(--expense)`, `var(--savings)`, `var(--credit)`, `var(--debit)`, `var(--positive)`, `var(--negative)` |

Fontes (carregadas por `@import` remoto no styles.css): **Hanken Grotesk** (UI), **Newsreader** (display/serif) e **IBM Plex Mono** (números e valores).

## Contratos de dados

- Valores monetários chegam aos componentes como **string mascarada pt-BR** (`"1.450,00"`), não número. `MoneyField.onChange` devolve a string já mascarada.
- Datas de período usam `"YYYY-MM"` (ex.: `historico[].periodo` do `HistoryChart`).
- `ItemRow`/`EditableList` esperam itens `{ nome, valor, venc?, pago?, cat? }`; `ParcelasProjecaoChart` espera `{ total, parcelas, pagas, pix? }`.
- `<img src="/logo.png">` (Sidebar) não é servido pelo bundle — a marca em texto "DinPrev" continua legível; não dependa do logo bitmap.

## Onde está a verdade

Leia `styles.css` (que importa `_ds_bundle.css`, onde vivem os tokens em `:root` / `[data-theme="dark"]` e todas as classes) antes de inventar estilo novo. Cada componente tem seu `components/general/<Nome>/<Nome>.prompt.md` com props e exemplos reais.

## Exemplo idiomático

```jsx
const { MoneyField, MetasResumo, ConfirmDialog } = window.DinPrev;

function PainelExemplo() {
  const [salario, setSalario] = React.useState('4.500,00');
  const [sair, setSair] = React.useState(false);
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
      <div className="card">
        <div className="card-head"><span className="card-title">Renda</span></div>
        <MoneyField label="Salário do mês" value={salario} onChange={setSalario} />
        <p className="hint">Distribuído antes de você gastar.</p>
      </div>
      <MetasResumo
        metas={[{ nome: 'Reserva', valor: '10.000,00', guardado: '6.500,00' }]}
        onManage={() => {}}
      />
      {sair && (
        <ConfirmDialog title="Sair da conta?" confirmLabel="Sair" cancelLabel="Cancelar" danger
          onConfirm={() => {}} onCancel={() => setSair(false)} />
      )}
    </div>
  );
}
```
