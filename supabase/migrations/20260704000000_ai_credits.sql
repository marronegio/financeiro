-- Créditos de IA por usuário e por mês, com limite dependente do ciclo do plano:
--   mensal (solo ou duo) → 250 créditos  |  anual → 900 créditos
-- 1 crédito = 1 chamada à OpenAI (mensagem do chat, rodada de ferramenta ou
-- transcrição de áudio). O gate fica nas Edge Functions ai-assistant/ai-transcribe.
--
-- Este arquivo é idempotente: a tabela/função podem já existir (foram criadas
-- manualmente no dashboard antes desta migration ser versionada).

-- Ciclo de cobrança do plano. O tier (solo/duo) já existe em `plan`; o ciclo é
-- gravado pelo asaas-create-subscription e pelo stripe-webhook.
--   null → desconhecido (assinantes antigos): tratado como 'monthly' no gate.
alter table public.profiles
  add column if not exists plan_cycle text
  check (plan_cycle in ('monthly', 'annual'));

-- Consumo de créditos: uma linha por usuário/mês. Virou o mês, começa uma linha
-- nova em zero — o "reset" é automático, sem cron.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month   text not null, -- 'YYYY-MM'
  credits integer not null default 0,
  primary key (user_id, month)
);

alter table public.ai_usage enable row level security;

-- O usuário pode LER o próprio consumo (pra UI mostrar "restam X créditos"),
-- mas nunca escrever: só a função consume_ai_credit (via service role) escreve.
drop policy if exists "read own usage" on public.ai_usage;
create policy "read own usage" on public.ai_usage
  for select using (auth.uid() = user_id);

-- Consome 1 crédito se ainda houver saldo no mês. Atômico: o upsert com WHERE
-- checa e incrementa numa operação só, então requisições simultâneas não furam
-- o limite. Retorna true se consumiu, false se o limite acabou.
create or replace function public.consume_ai_credit(p_user uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
begin
  if p_limit <= 0 then
    return false;
  end if;
  insert into public.ai_usage (user_id, month, credits)
  values (p_user, v_month, 1)
  on conflict (user_id, month)
    do update set credits = ai_usage.credits + 1
    where ai_usage.credits < p_limit;
  return found; -- false = o WHERE barrou o incremento (limite atingido)
end;
$$;

-- Só o backend (service role) pode consumir créditos. Sem isto, qualquer usuário
-- logado poderia chamar a RPC com o id de OUTRA pessoa e queimar os créditos dela.
revoke execute on function public.consume_ai_credit(uuid, int) from public, anon, authenticated;
grant execute on function public.consume_ai_credit(uuid, int) to service_role;
