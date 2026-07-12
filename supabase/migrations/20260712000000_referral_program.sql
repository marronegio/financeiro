-- Programa de indicação ("Indique e ganhe").
--
-- Modelo: cada indicação confirmada (1º pagamento do indicado) vira 1 crédito
-- de 10% para quem indicou. Os créditos ficam acumulados (banco) e são
-- consumidos nas renovações MENSAIS via ASAAS: até 10 créditos por fatura
-- (10 créditos = 100% = mês grátis); o que sobrar fica para os meses seguintes.
-- O indicado ganha 10% na primeira mensalidade (aplicado na create-subscription).
--
-- Papéis das colunas:
--   * referral_code     — código público do usuário (vai no link ?ref=CODIGO);
--                          gerado sob demanda pela edge function `referral`.
--   * referred_by       — quem indicou este usuário; resolvido no 1º checkout
--                          a partir do código informado no cadastro (metadata).
--   * referral_counted  — true depois que o 1º pagamento deste usuário creditou
--                          o indicador (garante que cada indicado conta uma vez).
--   * referral_credits  — créditos de 10% acumulados e ainda não consumidos.
--   * referral_total    — total histórico de indicações confirmadas (para a UI).
--   * referral_discounted_payment_id — última cobrança do ASAAS que consumiu
--                          créditos (idempotência do webhook; no mês 100% grátis
--                          também impede que o PAYMENT_DELETED da cobrança que
--                          nós removemos seja lido como cancelamento).

alter table public.profiles
  add column if not exists referral_code text unique,
  add column if not exists referred_by uuid references public.profiles (id) on delete set null,
  add column if not exists referral_counted boolean not null default false,
  add column if not exists referral_credits integer not null default 0,
  add column if not exists referral_total integer not null default 0,
  add column if not exists referral_discounted_payment_id text;

-- O checkout resolve o código informado no cadastro; índice ajuda essa busca
-- (o UNIQUE acima já cria índice, mas fica explícito para bases antigas).
create index if not exists profiles_referral_code_idx
  on public.profiles (referral_code);

-- Credita o indicador quando o 1º pagamento do indicado confirma.
-- Idempotente: o flip de referral_counted só acontece uma vez, então chamar de
-- novo (webhook reprocessado) devolve false e não credita em dobro.
create or replace function public.credit_referral(p_referred uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
begin
  update public.profiles
     set referral_counted = true,
         updated_at = now()
   where id = p_referred
     and referral_counted = false
     and referred_by is not null
  returning referred_by into v_referrer;

  if v_referrer is null then
    return false;
  end if;

  update public.profiles
     set referral_credits = referral_credits + 1,
         referral_total   = referral_total + 1,
         updated_at       = now()
   where id = v_referrer;

  return true;
end;
$$;

-- Só o service role (webhook) pode creditar — um usuário logado não pode
-- disparar créditos chamando a função via RPC. O revoke de PUBLIC tira o
-- EXECUTE default de todo mundo, então o service_role precisa do grant explícito.
revoke execute on function public.credit_referral(uuid) from public;
revoke execute on function public.credit_referral(uuid) from anon;
revoke execute on function public.credit_referral(uuid) from authenticated;
grant execute on function public.credit_referral(uuid) to service_role;
