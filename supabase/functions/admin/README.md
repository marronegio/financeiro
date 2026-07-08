# Edge Function `admin`

Painel administrativo do DinPrev. Lista todos os usuários e permite gerenciar
assinatura, IA, plano e créditos — tudo com 1 clique — **apenas para o admin**.

No app, aparece como uma aba nativa **"Admin"** na barra lateral, visível somente
para os e-mails configurados (frontend: `src/lib/admin.js`).

## Segurança

Duas camadas:

1. `verify_jwt = true` — a plataforma só deixa passar quem está logado.
2. Dentro da função, o e-mail do chamador é conferido contra o secret
   `ADMIN_EMAIL`. Só então o `service_role` é usado. Sem isso, qualquer usuário
   logado poderia mexer nos dados dos outros.

A checagem no frontend (`src/lib/admin.js`) é só cosmética (mostrar o link). A
autoridade real é esta função.

## Ações (campo `action` no corpo)

| ação | efeito |
|------|--------|
| `list` | lista usuários (perfil + e-mail + créditos de IA do mês) |
| `set_subscription` | `value: 'active' \| 'inactive' \| null` — override manual que ignora o gateway |
| `set_ai` | `enabled: bool` — liga/desliga o assistente de IA |
| `set_plan` | `plan: 'solo' \| 'duo'` |
| `reset_ai` | zera os créditos de IA do mês atual |
| `delete_user` | exclusão definitiva (dados + Auth) |

## Deploy

```bash
# 1) Migration (cria ai_enabled e admin_override em profiles)
supabase db push

# 2) Secret com o(s) e-mail(s) de admin (vírgula separa vários)
supabase secrets set ADMIN_EMAIL="giovannemarrone@gmail.com"

# 3) Deploy da função (e da compartilhada de créditos, que mudou)
supabase functions deploy admin
supabase functions deploy ai-assistant
supabase functions deploy ai-transcribe
```

No frontend, opcionalmente defina `VITE_ADMIN_EMAIL` no `.env` (mesmo e-mail) —
sem ela, cai no padrão em `src/lib/admin.js`.

## ⚠️ Atenção — `delete_user` e cobrança

A exclusão pelo painel apaga os dados da aplicação e o usuário no Auth, mas **não
cancela** a assinatura no Stripe/Asaas. Se for um assinante pagante, cancele a
cobrança no gateway antes (ou use o fluxo normal de exclusão da conta). Para
contas de teste/não pagantes, pode excluir direto.
