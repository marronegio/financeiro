-- Painel administrativo (só o admin usa; ver a Edge Function `admin`).
-- Adiciona dois controles manuais no perfil que o painel liga/desliga com 1 clique.
-- Idempotente: pode rodar mais de uma vez sem erro.

-- Liga/desliga o assistente de IA por usuário. Default true (todo mundo pode usar).
-- O gate do backend (_shared/aiCredits.ts) bloqueia quando isto é false, mesmo
-- que ainda haja créditos no mês.
alter table public.profiles
  add column if not exists ai_enabled boolean not null default true;

-- Override manual de acesso, que IGNORA o gateway de pagamento (Stripe/Asaas):
--   'active'   → cortesia: libera acesso mesmo sem assinatura paga
--   'inactive' → bloqueia acesso mesmo com assinatura paga
--   null       → sem override; vale a lógica normal (subscription_status/access_until)
-- Como não é o webhook que escreve esta coluna, um evento futuro do gateway não
-- reverte a decisão feita no painel.
alter table public.profiles
  add column if not exists admin_override text
  check (admin_override in ('active', 'inactive'));

-- Nada de política nova de RLS aqui: o usuário continua só LENDO o próprio perfil
-- (para o app respeitar ai_enabled/override). Quem ESCREVE nessas colunas é apenas
-- a Edge Function `admin`, que roda com service_role após conferir que o chamador
-- é o admin (ADMIN_EMAIL).
