-- Execute no Supabase: Dashboard → SQL Editor → New query → Run.
--
-- Controle anti-duplicado dos avisos de vencimento por e-mail ("vence amanhã").
-- Uma linha por (usuário, ocorrência de despesa). A Edge Function `notify-vencimentos`
-- grava aqui depois de enviar, e nunca reenvia a mesma chave.

create table if not exists public.despesa_avisos (
  user_id  uuid not null references auth.users (id) on delete cascade,
  chave    text not null,           -- 'perfil|nome|YYYY-MM' do vencimento avisado
  sent_at  timestamptz not null default now(),
  primary key (user_id, chave)
);

-- Sem políticas: apenas o service role (a função) escreve/lê. RLS ligado bloqueia
-- qualquer acesso de usuário comum.
alter table public.despesa_avisos enable row level security;


-- ──────────────────────────────────────────────────────────────────────────
-- AGENDAMENTO (roda a função 1x por dia, 09:00 em São Paulo = 12:00 UTC).
--
-- 1) Habilite as extensões (uma vez):
--      Dashboard → Database → Extensions → habilite "pg_cron" e "pg_net".
--
-- 2) Configure os secrets da função (Dashboard → Edge Functions → notify-vencimentos
--    → Secrets), ou via CLI `supabase secrets set`:
--      RESEND_API_KEY    = a MESMA API key do Resend que já usa no SMTP do Auth
--                          (o secret do SMTP do Dashboard não chega às Edge Functions,
--                           por isso precisa cadastrá-la aqui também)
--      NOTIF_FROM_EMAIL  = o MESMO remetente dos e-mails de verificação
--                          (ex.: DinPrev <noreply@seudominio.com> — domínio já verificado)
--      CRON_SECRET       = uma string aleatória longa (a mesma usada abaixo)
--    (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem por padrão.)
--
-- 3) Faça o deploy: `supabase functions deploy notify-vencimentos`
--
-- 4) Agende, trocando <PROJECT_REF>, <ANON_KEY> e <CRON_SECRET> pelos seus valores.
--    O Authorization usa a anon key só para passar pela verificação de JWT da função;
--    a autorização real é o header x-cron-secret.

select cron.schedule(
  'notify-vencimentos-diario',
  '0 12 * * *',  -- 12:00 UTC = 09:00 America/Sao_Paulo
  $$
  select net.http_post(
    url     := 'https://kbyobwxpsyntfygtqjir.supabase.co/functions/v1/notify-vencimentos',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtieW9id3hwc3ludGZ5Z3RxamlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NzE1OTksImV4cCI6MjA5NjQ0NzU5OX0.7I__v_z4HMjagiil-COTGRfr_DBhbte80GPYwxPJCSs',
      'x-cron-secret', '<CRON_SECRET>'  -- troque pelo valor configurado no secret da função
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Para remover/reagendar:  select cron.unschedule('notify-vencimentos-diario');
