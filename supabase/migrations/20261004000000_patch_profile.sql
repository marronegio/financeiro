-- Gravação por campo, com versão por perfil.
--
-- O save_profile troca o PERFIL INTEIRO pelo que o aparelho mandou. Um aparelho
-- com a tela velha — o notebook que acordou da suspensão, o app aberto há dias
-- no celular — que tocasse em qualquer coisa (até trocar de aba, que morava no
-- perfil) subia o perfil todo e apagava o que o outro aparelho tinha gravado.
--
-- patch_profile grava só os campos que mudaram, e só se o perfil no servidor
-- ainda estiver na versão (`rev`) de onde a edição partiu. Se outro aparelho
-- gravou no meio, nada é gravado e a função devolve o perfil atual: o app
-- encaixa a edição dele por cima (src/sync.js) e tenta de novo.
--
-- O `rev` mora dentro do próprio perfil (profiles.<pid>.rev), então viaja no
-- blob que o app já lê, e o parceiro do Duo editando o perfil dele não conta
-- como conflito para o titular.

create or replace function public.patch_profile(
  pid        text,
  base_rev   bigint,
  data_patch jsonb,
  meta_patch jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  cur     jsonb;
  cur_rev bigint;
  meta    jsonb := coalesce(meta_patch, '{}'::jsonb) - 'data' - 'rev';
  dados   jsonb := coalesce(data_patch, '{}'::jsonb);
  nxt     jsonb;
begin
  -- `for update` segura a linha até o fim: entre conferir a versão e gravar,
  -- ninguém mais grava.
  select state -> 'profiles' -> pid
    into cur
    from public.finances
   where user_id = auth.uid()
     for update;

  if cur is null or jsonb_typeof(cur) <> 'object' then
    return jsonb_build_object('ok', false, 'profile', null);
  end if;

  cur_rev := coalesce((cur ->> 'rev')::bigint, 0);
  if cur_rev <> base_rev then
    return jsonb_build_object('ok', false, 'profile', cur);
  end if;

  -- null no patch = campo removido (ex.: PIN apagado).
  nxt := (cur || meta)
         - array(select key from jsonb_each(meta) where value = 'null'::jsonb);
  nxt := jsonb_set(
           nxt,
           '{data}',
           (coalesce(cur -> 'data', '{}'::jsonb) || dados)
             - array(select key from jsonb_each(dados) where value = 'null'::jsonb),
           true);
  nxt := jsonb_set(nxt, '{rev}', to_jsonb(cur_rev + 1), true);

  update public.finances
     set state = jsonb_set(state, array['profiles', pid], nxt, true),
         updated_at = now()
   where user_id = auth.uid();

  return jsonb_build_object('ok', true, 'rev', cur_rev + 1);
end;
$$;

-- O save_profile continua (criar/apagar o perfil do parceiro, e o app antigo
-- que ainda está instalado nos celulares), mas agora também anda com o `rev`:
-- assim o app novo percebe a gravação do antigo e encaixa a sua por cima, em vez
-- de achar que nada mudou.
create or replace function public.save_profile(pid text, pdata jsonb)
returns void
language sql
security invoker
as $$
  update public.finances
     set state = case
           when pdata is null then state #- array['profiles', pid]
           else jsonb_set(
                  state,
                  array['profiles', pid],
                  pdata || jsonb_build_object(
                    'rev', coalesce((state #>> array['profiles', pid, 'rev'])::bigint, 0) + 1),
                  true)
         end,
         updated_at = now()
   where user_id = auth.uid();
$$;
