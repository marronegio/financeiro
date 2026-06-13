-- Execute no Supabase: Dashboard → SQL Editor → New query → Run.
-- Cria a tabela de perfis com campos de assinatura Stripe.

create table if not exists public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id    text unique,
  subscription_id       text,
  subscription_status   text not null default 'inactive',
  updated_at            timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Usuário lê apenas seu próprio perfil.
create policy "ler proprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

-- Somente o service role (webhook) pode escrever — sem política de insert/update para anon/user.
-- O frontend nunca grava diretamente nessa tabela.
