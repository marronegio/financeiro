-- Execute no Supabase: Dashboard → SQL Editor → New query → Run.
-- Registra quais CPFs já usaram o teste grátis de 7 dias, para impedir que a
-- mesma pessoa pegue trial de novo — mesmo cancelando, apagando a conta, ou
-- criando outro e-mail. A chave é o CPF (só dígitos), então sobrevive à exclusão
-- do usuário no Auth e independe do e-mail.

create table if not exists public.trial_redemptions (
  cpf         text primary key,
  redeemed_at timestamptz not null default now()
);

alter table public.trial_redemptions enable row level security;

-- Sem políticas para anon/usuário: apenas o service role (Edge Functions) lê e escreve.
-- O frontend nunca toca nesta tabela.

-- ── Migração de uma versão anterior em que a chave era o e-mail ──
-- Não dá para converter e-mail em CPF, então o controle antigo é descartado.
-- Rode uma vez, se a tabela existir com a coluna 'email':
--   drop table if exists public.trial_redemptions;
-- e então recrie com o create table acima.
