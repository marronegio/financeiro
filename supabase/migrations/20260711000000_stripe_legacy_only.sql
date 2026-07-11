-- Stripe vira legado: o checkout agora é exclusivamente ASAAS.
--
-- Perfis novos nasciam com payment_provider = 'stripe' por causa do default
-- da migração 20260701000000, mesmo sem nunca terem passado por checkout —
-- daí contas recém-criadas aparecerem como "stripe" no painel admin.
--
-- Regras:
--   * default passa a ser 'asaas' (todo cadastro novo);
--   * quem nunca teve assinatura no Stripe (subscription_id nulo) é
--     reclassificado como 'asaas' — inclui contas que nunca pagaram e
--     ex-assinantes cancelados, que só poderão voltar pelo ASAAS;
--   * quem tem assinatura Stripe vigente (subscription_id preenchido:
--     ativa, em teste ou past_due) permanece 'stripe' e segue gerenciado
--     pelo stripe-webhook / customer-portal normalmente.

alter table public.profiles
  alter column payment_provider set default 'asaas';

update public.profiles
   set payment_provider = 'asaas',
       updated_at = now()
 where payment_provider = 'stripe'
   and subscription_id is null;
