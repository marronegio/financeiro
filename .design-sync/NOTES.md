# Notas do design-sync (DinPrev)

- Repo é um APP Vite+React (JSX, sem TypeScript), não uma biblioteca: não há build de `dist/` — o conversor roda em modo synth-entry a partir de `src/`.
- Sem Storybook (confirmado com o usuário em 2026-07-13).
- Package manager: npm (`package-lock.json`).
- Tema via atributo `data-theme` no `<html>` (ver `src/theme.js`); tokens são CSS vars em `src/styles.css` (`:root` claro + `[data-theme="dark"]`).
- Fontes: Google Fonts via `@import` remoto no topo de `src/styles.css` (Newsreader, Hanken Grotesk, IBM Plex Mono) — esperado `[FONT_REMOTE]`.
- Muitos componentes são painéis acoplados a Supabase/AuthContext (`*Panel`, Dashboard, AdminPanel, AiAssistant) — candidatos a skip/floor card.
- Escopo de previews autorados (escolha do usuário, 2026-07-13): core reutilizável ~13 — ConfirmDialog, MoneyField, PasswordInput, PinField, PinDialog, ItemRow, EditableList, HistoryChart, ParcelasProjecaoChart, MetasResumo, DespesaAlerts, PaywallModal, Sidebar.
- Fork `overrides/source-kit.mjs`: todos os componentes são `export default`; o entry sintetizado precisa de `export { default as Name }` além de `export * from` (senão nada chega em `window.DinPrev`).
- `entry` no config aponta para um caminho inexistente DE PROPÓSITO (`src/__no_dist__.js`): ancora o PKG_DIR na raiz do repo e força o modo synth-entry. Não "consertar".
- `srcDir` é `src/components` de propósito: exclui `src/main.jsx` (monta o app no load do módulo — efeito colateral fatal no bundle) e `App.jsx`/`Dashboard.jsx` (exigem AuthContext).
- Regex com caracteres combinantes literais quebra o smoke test do validate (página sem charset lê o JS como windows-1252). Corrigido em CasalPanel.jsx usando `̀-ͯ` escapado — manter escapado em código novo.

## Aprendizados da autoria de previews (2026-07-13)

- Modais (`.ob-backdrop` fixed inset:0): moldura `position:relative; height:Npx; transform:translateZ(0)` no preview contém o fixed e centraliza o modal. Usado em ConfirmDialog, PinDialog; mesma técnica para DespesaAlerts (toast-stack fixed bottom-right).
- Sidebar: breakpoint mobile é 820px — override `viewport: "1000x780"` para renderizar o shell desktop; abaixo disso só aparece a topbar mobile.
- LandingDemo/LandingPage usam `.reveal` (opacity:0 até o IntersectionObserver da landing adicionar `.visible`) — no preview, forçar com `<style>.reveal{opacity:1!important;transform:none!important}</style>`.
- O harness de captura congela o relógio (screenshots determinísticos) — datas nos gráficos aparecem como 2024; não é bug.
- PaywallModal: inautorável estaticamente (useAuth exige AuthProvider + Supabase reais; polling de assinatura). Fica no floor card — decisão registrada, revisitar só se o usuário pedir.
- Bug real do app achado e corrigido durante a autoria: `input[type="text"]` global vencia `.pg-pin-input` e tirava a borda do PIN visível → regra virou `input.pg-pin-input` (mesma convenção de `input.goal-name`).
- `<img src="/logo.png">` (Sidebar/topbar) não existe no bundle → ícone de imagem quebrada pequeno nos cards e nos designs gerados. Limitação conhecida; o wordmark "DinPrev" ao lado mantém a marca legível.

## Re-sync risks

- Os previews em `.design-sync/previews/` compõem APIs internas dos componentes (props/shapes de dados como `{nome, valor, venc, pago}`) — mudança de API quebra o preview e exige re-autoria, não é detectada por diff de config.
- `DespesaAlerts.tsx` deriva `venc` de `new Date()` para cair na janela de alerta (3/1/0 dias); se `ALERT_DAYS` mudar em `src/despesaAlerts.js`, as stories podem parar de mostrar toasts.
- `conventions.md` enumera classes e tokens reais (`.card`, `--expense`, etc.) — renomeações no styles.css exigem revalidar o header (o passo de validação do skill roda em todo re-sync).
- O entry sintetizado + fork de `source-kit.mjs` assumem: componentes em `src/components`, um por arquivo, `export default` com basename PascalCase. Arquivo novo fora desse padrão não entra no bundle.
- Fontes vêm de `@import` remoto do Google Fonts — sem rede, cards renderizam em fallback ([FONT_REMOTE] é o comportamento esperado).
- Verificação parcial deliberada: PaywallModal no floor card; painéis acoplados a Supabase (AdminPanel etc.) renderizam seus próprios estados de erro/vazio — cards honestos, não regressões.

## Known render warns

- `[RENDER_THIN]` EyeIcon: legítimo — é um ícone SVG de ~14px sem texto; renderiza correto (ver screenshot).
- AdminPanel renderiza com um banner de erro próprio ("Cannot read properties of null") — é o estado de erro real do componente sem Supabase; card honesto, não bloqueia.
