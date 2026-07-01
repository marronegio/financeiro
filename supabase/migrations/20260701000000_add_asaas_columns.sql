-- Migração para suportar o gateway ASAAS ao lado do Stripe.
--
-- O acesso do usuário continua sendo decidido por profiles.subscription_status
-- (agnóstico de gateway). Estas colunas apenas dizem QUAL gateway gerencia a
-- assinatura de cada perfil e guardam os IDs do ASAAS.
--
-- Contas existentes ficam como 'stripe' (default) — assim o assinante atual do
-- Stripe segue sendo tratado pelo webhook do Stripe, sem quebrar o acesso.
-- Cadastros novos passam a gravar 'asaas' na create-subscription.

alter table public.profiles
  add column if not exists payment_provider text not null default 'stripe',
  add column if not exists asaas_customer_id text,
  add column if not exists asaas_subscription_id text;

-- O webhook do ASAAS localiza o perfil pelo customer; índice ajuda essa busca.
create index if not exists profiles_asaas_customer_id_idx
  on public.profiles (asaas_customer_id);
