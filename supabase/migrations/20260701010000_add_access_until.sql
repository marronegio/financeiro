-- Cancelamento no fim do período: em vez de revogar o acesso na hora, guardamos
-- até quando o usuário já pagou. O gate de acesso considera essa data.
--  - null            → sem expiração agendada (assinatura ativa normal)
--  - data no futuro  → cancelou, mas mantém acesso até lá
--  - data no passado → acesso expirado (cai no paywall)
alter table public.profiles
  add column if not exists access_until timestamptz;
