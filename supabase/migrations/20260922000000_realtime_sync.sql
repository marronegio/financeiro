-- Sincronização entre dispositivos: avisar os outros aparelhos assim que os
-- dados mudam, em vez de esperar que alguém recarregue a página.
--
-- Até aqui o app lia `finances` UMA vez, ao abrir. Quem deixa o DinPrev aberto
-- no notebook enquanto lança as coisas no desktop passa o dia com a tela
-- desatualizada — e a primeira edição feita nessa tela velha sobrescreve o que
-- o outro aparelho tinha gravado.
--
-- Por que uma tabela separada em vez de escutar `finances` direto: o Realtime
-- manda a LINHA INTEIRA em cada evento, e o blob de `finances` carrega o
-- histórico e as fotos de perfil (data URLs). Seriam centenas de KB para cada
-- aparelho conectado a cada gravação — e o app grava a cada 600 ms de digitação.
-- Aqui viaja só o carimbo de hora; quem recebe rebusca o blob por HTTP, uma vez.

create table if not exists public.finances_sync (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now(),
  rev        bigint not null default 1
);

alter table public.finances_sync enable row level security;

-- Só leitura, e só da própria linha: quem escreve aqui é o gatilho abaixo.
drop policy if exists "ler proprio carimbo" on public.finances_sync;
create policy "ler proprio carimbo"
  on public.finances_sync for select
  using (auth.uid() = user_id);

-- security definer: o gatilho grava numa tabela onde o usuário não tem (nem
-- precisa ter) permissão de escrita.
create or replace function public.touch_finances_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.finances_sync (user_id, updated_at, rev)
       values (new.user_id, now(), 1)
  on conflict (user_id) do update
       set updated_at = now(),
           rev = finances_sync.rev + 1;
  return new;
end;
$$;

-- No gatilho de tabela, pouco importa por onde veio a gravação: o save_profile
-- (RPC do plano Duo) e o upsert do blob inteiro caem os dois aqui.
drop trigger if exists finances_sync_touch on public.finances;
create trigger finances_sync_touch
  after insert or update on public.finances
  for each row execute function public.touch_finances_sync();

-- Publica a tabela no Realtime. Idempotente: pode rodar de novo sem erro.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'finances_sync'
  ) then
    alter publication supabase_realtime add table public.finances_sync;
  end if;
end;
$$;

-- Carimbo inicial para quem já tem dados (o gatilho só pega gravações novas).
insert into public.finances_sync (user_id)
select user_id from public.finances
on conflict (user_id) do nothing;
