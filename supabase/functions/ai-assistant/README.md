# Assistente de IA — setup

Proxy seguro entre o app e a OpenAI. A chave da OpenAI fica só aqui (secret da
função), nunca no frontend.

## 1. Chave da OpenAI

1. Em https://platform.openai.com → **Billing**: adicione crédito (a API é
   pré-paga e separada do ChatGPT Plus).
2. **API keys** → *Create new secret key*. Copie (só aparece uma vez).

## 2. Configurar o secret no Supabase

```bash
supabase secrets set OPENAI_API_KEY=sk-...
# opcional — trocar o modelo (padrão: gpt-4o-mini):
supabase secrets set OPENAI_MODEL=gpt-4o
```

## 3. Deploy

```bash
supabase functions deploy ai-assistant
```

`verify_jwt = true` (em `supabase/config.toml`): só usuários logados chamam a
função — evita que estranhos gastem seus tokens.

## Como funciona

- O frontend (`src/components/AiAssistant.jsx`) manda a conversa + um resumo do
  contexto financeiro (`compute(state)`) e a tela atual (`state.tab`).
- A função monta o system prompt, declara as *tools* (lançar gasto, despesa,
  renda, etc.) e chama a OpenAI.
- Quando o modelo pede uma ferramenta, o **frontend** a executa em
  `src/lib/aiActions.js` via `setState` — o `useCloudState` salva no Supabase.

## Créditos de IA por mês

Cada chamada à OpenAI (mensagem, rodada de ferramenta ou transcrição de áudio)
consome **1 crédito** do mês do usuário (`_shared/aiCredits.ts` + tabela
`ai_usage`, migration `ai_credits`). O limite depende do ciclo do plano
(`profiles.plan_cycle`, gravado pelos fluxos de pagamento):

| Plano                       | Créditos/mês |
| --------------------------- | ------------ |
| Mensal (solo ou duo)        | 250          |
| Anual (solo ou duo)         | 900          |
| `plan_cycle` desconhecido   | 250          |

Estourou o limite → a função responde **429** com `error: 'limit_reached'` e o
chat mostra a mensagem amigável. O reset é automático na virada do mês (a chave
da tabela é `user_id + 'YYYY-MM'`). Para ajustar os limites sem deploy:

```bash
supabase secrets set AI_CREDITS_MONTHLY=300 AI_CREDITS_ANNUAL=1000
```

## Teste local

```bash
supabase functions serve ai-assistant --env-file supabase/.env.local
# supabase/.env.local com: OPENAI_API_KEY=sk-...
```
