-- Execute no Supabase: Dashboard → SQL Editor → New query → Run.
-- Registra quais e-mails já usaram o teste grátis de 7 dias, para impedir que a
-- mesma pessoa pegue trial de novo (mesmo após cancelar, ou apagar e recriar a conta).
-- A chave é o e-mail (minúsculo), então sobrevive à exclusão do usuário no Auth.

create table if not exists public.trial_redemptions (
  email       text primary key,
  redeemed_at timestamptz not null default now()
);

alter table public.trial_redemptions enable row level security;

-- Sem políticas para anon/usuário: apenas o service role (Edge Functions) lê e escreve.
-- O frontend nunca toca nesta tabela.
