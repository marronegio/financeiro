-- Execute este SQL no Supabase: Dashboard → SQL Editor → New query → Run.
-- Cria a tabela de dados financeiros (uma linha por usuário) com Row Level Security,
-- de modo que cada usuário só enxerga e altera os próprios dados.

create table if not exists public.finances (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.finances enable row level security;

-- Cada usuário lê/insere/atualiza/apaga apenas a linha cujo user_id = seu próprio id.
create policy "ler proprios dados"
  on public.finances for select
  using (auth.uid() = user_id);

create policy "inserir proprios dados"
  on public.finances for insert
  with check (auth.uid() = user_id);

create policy "atualizar proprios dados"
  on public.finances for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "apagar proprios dados"
  on public.finances for delete
  using (auth.uid() = user_id);
