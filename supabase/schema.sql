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

-- ── Gravação por perfil (plano Duo, edição simultânea) ────────────────────
-- Grava apenas UM perfil dentro do blob, de forma atômica no servidor: cada
-- dispositivo salva só o próprio perfil e nunca sobrescreve o do parceiro.
-- pdata = null remove o perfil (usado ao excluir o perfil do parceiro).
create or replace function public.save_profile(pid text, pdata jsonb)
returns void
language sql
security invoker
as $$
  update public.finances
     set state = case
           when pdata is null then state #- array['profiles', pid]
           else jsonb_set(state, array['profiles', pid], pdata, true)
         end,
         updated_at = now()
   where user_id = auth.uid();
$$;
