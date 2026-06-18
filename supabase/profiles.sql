-- Execute no Supabase: Dashboard → SQL Editor → New query → Run.
-- Cria a tabela de perfis com campos de assinatura Stripe.

create table if not exists public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id    text unique,
  subscription_id       text,
  subscription_status   text not null default 'inactive',
  plan                  text not null default 'solo', -- 'solo' | 'duo' (gravado pelo webhook a partir do price)
  updated_at            timestamptz not null default now()
);

-- Para bases já existentes (rode uma vez se a coluna ainda não existir):
alter table public.profiles add column if not exists plan text not null default 'solo';

alter table public.profiles enable row level security;

-- Usuário lê apenas seu próprio perfil.
create policy "ler proprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

-- Somente o service role (webhook) pode escrever — sem política de insert/update para anon/user.
-- O frontend nunca grava diretamente nessa tabela.
