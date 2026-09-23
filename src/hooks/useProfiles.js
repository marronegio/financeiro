import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { supabase } from '../lib/supabase.js';
import { isNativeApp } from '../lib/native.js';
import {
  createDefaultProfiles,
  migrateState,
  mergeRemoteProfiles,
  createDefaultState,
  PROFILE_NAMES,
} from '../state.js';

// ── Perfil ativo é uma escolha POR DISPOSITIVO ─────────────────────────────
// Guardado no localStorage (não na nuvem): no plano Duo, cada pessoa fica no
// seu perfil no seu aparelho — trocar de perfil aqui não afeta o outro lado.
const activeKey = (userId) => `dinprev-active-profile:${userId}`;

function readStoredActive(userId) {
  try {
    return localStorage.getItem(activeKey(userId)) === 'partner' ? 'partner' : 'main';
  } catch {
    return 'main';
  }
}

// ── Sincronização entre dispositivos ───────────────────────────────────────
// Janela para juntar pedidos de releitura que chegam quase juntos.
const PULL_DEBOUNCE = 400;
// Rede de segurança: com a tela à vista, confere o servidor de tempos em
// tempos. Só entra em ação se o aviso em tempo real não chegar (Realtime não
// habilitado no banco, websocket bloqueado por firewall, etc.).
const POLL_MS = 5 * 60 * 1000;

function storeActive(userId, id) {
  try {
    localStorage.setItem(activeKey(userId), id);
  } catch {
    /* localStorage indisponível: a escolha só não sobrevive ao reload */
  }
}

// Expõe o estado financeiro do PERFIL ATIVO com o mesmo contrato de sempre
// (`state` + `setState`), mais a gestão de perfis do plano Duo.
//
// Persistência: cada alteração grava APENAS o perfil alterado, de forma
// atômica no servidor (RPC save_profile + jsonb_set). Assim dois aparelhos
// podem editar perfis diferentes ao mesmo tempo sem um sobrescrever o outro.
export function useProfiles(userId, planTier) {
  const [raw, setRawState] = useState(null); // blob completo { v, profiles }
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [activeLocal, setActiveLocal] = useState(() => readStoredActive(userId));

  const isDuo = planTier === 'duo';

  // Refs para callbacks estáveis (o Dashboard depende da identidade de setState).
  const isDuoRef = useRef(isDuo);
  isDuoRef.current = isDuo;
  const rawRef = useRef(raw);
  rawRef.current = raw;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // O perfil pedido só vale se existir (e o Duo estiver ativo); senão, 'main'.
  const active =
    activeLocal === 'partner' && isDuo && raw?.profiles?.partner ? 'partner' : 'main';
  const activeRef = useRef(active);
  activeRef.current = active;

  // ── Fila de gravação: quais perfis mudaram desde o último flush ──────────
  const pendingRef = useRef(new Set());
  const saveTimer = useRef(null);
  // Perfis com RPC em voo. Junto com `pendingRef` formam "o que é nosso e ainda
  // não está confirmado no servidor" — o que chega de fora não pode atropelar.
  const writingRef = useRef(new Set());
  const flushingRef = useRef(null);

  const isOurs = useCallback(
    (pid) => pendingRef.current.has(pid) || writingRef.current.has(pid),
    []
  );

  const writePending = useCallback(async (pending) => {
    const blob = rawRef.current;
    if (!blob) return;

    for (const pid of pending) {
      // Perfil ausente no blob = foi removido → pdata null apaga no servidor.
      const pdata = blob.profiles[pid] ?? null;
      const { error } = await supabase.rpc('save_profile', { pid, pdata });
      if (!error) continue;

      // Função ainda não criada no banco (rode supabase/schema.sql): cai no
      // upsert do blob inteiro — comportamento antigo, funcional porém sem
      // proteção contra edição simultânea.
      if (error.code === 'PGRST202') {
        const { error: upErr } = await supabase
          .from('finances')
          .upsert({ user_id: userIdRef.current, state: blob, updated_at: new Date().toISOString() });
        if (upErr) console.error('Falha ao salvar dados:', upErr);
        return;
      }
      console.error('Falha ao salvar perfil:', error);
    }
  }, []);

  // Sobe a fila. Em série (uma gravação por vez) porque agora existe quem
  // espere por ela: toda releitura vinda de fora dá flush antes de buscar, e
  // dois flushes sobrepostos deixariam a busca correr contra a gravação.
  const flush = useCallback(() => {
    clearTimeout(saveTimer.current);
    const run = async () => {
      const pending = pendingRef.current;
      if (pending.size === 0 || !userIdRef.current) return;
      pendingRef.current = new Set();
      writingRef.current = pending;
      try {
        await writePending(pending);
      } finally {
        writingRef.current = new Set();
      }
    };
    const next = (flushingRef.current ?? Promise.resolve()).then(run, run);
    flushingRef.current = next;
    return next;
  }, [writePending]);

  const queueSave = useCallback((pid) => {
    pendingRef.current.add(pid);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 600);
  }, [flush]);

  // Grava o que estiver pendente ao desmontar/trocar de usuário.
  useEffect(() => () => { flush(); }, [flush]);

  // ── Carregamento ──────────────────────────────────────────────────────────
  const fetchBlob = useCallback(async () => {
    const { data, error } = await supabase
      .from('finances')
      .select('state')
      .eq('user_id', userIdRef.current)
      .maybeSingle();
    if (error) throw error;
    return data?.state;
  }, []);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setStatus('loading');
    setActiveLocal(readStoredActive(userId));
    pendingRef.current = new Set();

    (async () => {
      try {
        const dbState = await fetchBlob();
        const migrated = migrateState(dbState);
        // Normaliza o banco para a forma v2 (conta nova ou blob antigo v1):
        // a gravação por perfil (jsonb_set) precisa do caminho profiles.* já
        // existente na linha.
        if (!dbState || dbState.v !== 2) {
          await supabase
            .from('finances')
            .upsert({ user_id: userId, state: migrated, updated_at: new Date().toISOString() });
        }
        if (!alive) return;
        setRawState(migrated);
        setStatus('ready');
      } catch (err) {
        if (!alive) return;
        console.error('Falha ao carregar dados:', err);
        setRawState(migrateState(undefined));
        setStatus('error');
      }
    })();

    return () => { alive = false; };
  }, [userId, fetchBlob]);

  // ── Chegada de fora ───────────────────────────────────────────────────────
  // Encaixa no local o blob que veio do servidor. Não é uma troca cega: o que
  // ainda não subiu daqui continua valendo, senão uma releitura no meio da
  // digitação apagaria o que a pessoa acabou de escrever.
  const applyRemote = useCallback((dbState) => {
    const incoming = migrateState(dbState);
    setRawState((cur) => mergeRemoteProfiles(cur, incoming, isOurs));
  }, [isOurs]);

  // Rebusca o blob (o outro perfil, ou o outro aparelho, pode ter editado).
  // Grava o pendente antes, para o fetch já voltar com as nossas mudanças.
  const reload = useCallback(async () => {
    if (!userIdRef.current) return;
    try {
      await flush();
      const dbState = await fetchBlob();
      if (dbState?.v === 2) applyRemote(dbState);
    } catch (err) {
      console.error('Falha ao atualizar dados:', err);
    }
  }, [flush, fetchBlob, applyRemote]);

  // Vários gatilhos podem pedir releitura ao mesmo tempo (o aviso do Realtime
  // chega junto com o foco da janela, por exemplo). Uma busca só resolve todos.
  //
  // Fora de vista, o aviso não vira busca — quem volta para a tela busca de
  // qualquer jeito (ver o efeito de "acordar"), então nada se perde. Ninguém
  // está olhando mesmo, e o blob rebuscado é a parte cara disto: ele carrega
  // as fotos de perfil. Sem esta guarda, dez minutos de digitação no desktop
  // baixariam o blob inteiro a cada 600 ms no notebook esquecido aberto atrás
  // da janela.
  const pullTimer = useRef(null);
  const pullSoon = useCallback(() => {
    clearTimeout(pullTimer.current);
    pullTimer.current = setTimeout(reload, PULL_DEBOUNCE);
  }, [reload]);

  // Para os avisos que chegam de fora. Quem está voltando para a tela usa o
  // `pullSoon` direto: ali a busca é justamente o que se quer.
  const schedulePull = useCallback(() => {
    if (document.visibilityState === 'hidden') return;
    pullSoon();
  }, [pullSoon]);

  useEffect(() => () => clearTimeout(pullTimer.current), []);

  // Aviso em tempo real: o gatilho do banco carimba `finances_sync` a cada
  // gravação e o Supabase avisa os outros aparelhos ligados na mesma conta.
  // O evento não carrega os dados (ver a migração 20260922000000) — ele só diz
  // "mudou"; quem busca é o reload.
  //
  // Sem a migração aplicada, o canal simplesmente nunca recebe nada: o app
  // continua igual, atualizando ao voltar para a tela.
  useEffect(() => {
    if (!userId) return;
    let subscribedBefore = false;
    const channel = supabase
      .channel(`finances-sync:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'finances_sync', filter: `user_id=eq.${userId}` },
        schedulePull
      )
      .subscribe((chanStatus) => {
        // Reconexão (dormiu, caiu a rede): o que passou enquanto estávamos
        // fora não é reenviado, então buscamos na mão ao voltar.
        if (chanStatus !== 'SUBSCRIBED') return;
        if (subscribedBefore) schedulePull();
        subscribedBefore = true;
      });
    return () => { supabase.removeChannel(channel); };
  }, [userId, schedulePull]);

  // Voltar para o app confere o servidor — é o caminho que cobre o aparelho
  // que passou a noite suspenso, quando nem o websocket sobrevive. Sair de
  // vista faz o contrário: empurra logo o que ainda estava na fila.
  useEffect(() => {
    if (!userId) return;
    const onWake = () => {
      if (document.visibilityState === 'hidden') flush();
      else pullSoon();
    };
    window.addEventListener('focus', onWake);
    window.addEventListener('online', onWake);
    document.addEventListener('visibilitychange', onWake);
    // No app empacotado a aba nunca "perde o foco": quem avisa é o Capacitor.
    const native = isNativeApp ? CapApp.addListener('resume', pullSoon) : null;
    const poll = setInterval(schedulePull, POLL_MS);
    return () => {
      window.removeEventListener('focus', onWake);
      window.removeEventListener('online', onWake);
      document.removeEventListener('visibilitychange', onWake);
      native?.then((h) => h.remove()).catch(() => {});
      clearInterval(poll);
    };
  }, [userId, pullSoon, schedulePull, flush]);

  // ── Mutações ──────────────────────────────────────────────────────────────

  // Escreve apenas no perfil ativo. Aceita updater (função) ou valor.
  const setState = useCallback((updater) => {
    setRawState((r) => {
      if (!r) return r;
      const id = activeRef.current;
      const cur = r.profiles[id].data;
      const next = typeof updater === 'function' ? updater(cur) : updater;
      if (next === cur) return r; // no-op (ex.: rollover sem nada a fechar)
      queueSave(id);
      return { ...r, profiles: { ...r.profiles, [id]: { ...r.profiles[id], data: next } } };
    });
  }, [queueSave]);

  const switchProfile = useCallback((id) => {
    if (id === 'partner' && !(isDuoRef.current && rawRef.current?.profiles?.partner)) return;
    storeActive(userIdRef.current, id);
    setActiveLocal(id);
    reload();
  }, [reload]);

  // Cria o perfil do parceiro e o torna ativo NESTE dispositivo.
  const addPartner = useCallback((opts = {}) => {
    setRawState((r) => {
      if (!r || !isDuoRef.current || r.profiles.partner) return r;
      const data = createDefaultState();
      if (opts.avatar) data.avatar = opts.avatar;
      const partner = { name: opts.name?.trim() || PROFILE_NAMES.partner, data };
      if (opts.pin) partner.pin = opts.pin;
      queueSave('partner');
      return { ...r, profiles: { ...r.profiles, partner } };
    });
    storeActive(userIdRef.current, 'partner');
    setActiveLocal('partner');
  }, [queueSave]);

  // Confere o PIN de um perfil. Perfil sem PIN é sempre liberado.
  const verifyPin = useCallback((id, pin) => {
    const p = rawRef.current?.profiles?.[id];
    if (!p) return false;
    if (!p.pin) return true;
    return p.pin === pin;
  }, []);

  // Define (4 dígitos) ou remove (vazio) o PIN de um perfil.
  const setProfilePin = useCallback((id, pin) => {
    setRawState((r) => {
      if (!r || !r.profiles[id]) return r;
      const p = { ...r.profiles[id] };
      if (pin) p.pin = pin;
      else delete p.pin;
      if (id === 'main') p.pinPrompted = true;
      queueSave(id);
      return { ...r, profiles: { ...r.profiles, [id]: p } };
    });
  }, [queueSave]);

  const renameProfile = useCallback((id, name) => {
    setRawState((r) => {
      if (!r || !r.profiles[id]) return r;
      queueSave(id);
      return { ...r, profiles: { ...r.profiles, [id]: { ...r.profiles[id], name } } };
    });
  }, [queueSave]);

  const removePartner = useCallback(() => {
    setRawState((r) => {
      if (!r || !r.profiles.partner) return r;
      const { partner, ...rest } = r.profiles;
      queueSave('partner'); // ausente no blob → o flush apaga no servidor
      return { ...r, profiles: rest };
    });
    storeActive(userIdRef.current, 'main');
    setActiveLocal('main');
  }, [queueSave]);

  const hasPartner = !!raw?.profiles?.partner;
  const state = raw ? raw.profiles[active].data : null;

  // Leitura dos DOIS perfis para a "Visão do casal" (Duo). Só leitura: toda
  // escrita continua passando por setState (que grava apenas o perfil ativo).
  const allProfiles = isDuo ? raw?.profiles ?? null : null;

  // Lista para o seletor. O parceiro só aparece dentro do plano Duo. `hasPin`
  // diz ao gate quais perfis pedem PIN antes de entrar (sem expor o PIN).
  const profileList = raw
    ? [
        { id: 'main', name: raw.profiles.main.name, avatar: raw.profiles.main.data.avatar, hasPin: !!raw.profiles.main.pin },
        ...(isDuo && raw.profiles.partner
          ? [{ id: 'partner', name: raw.profiles.partner.name, avatar: raw.profiles.partner.data.avatar, hasPin: !!raw.profiles.partner.pin }]
          : []),
      ]
    : [];

  // Só no Duo e enquanto o titular ainda não passou pela oferta de PIN.
  const mainNeedsPinSetup = isDuo && !!raw && !raw.profiles.main.pinPrompted;

  return {
    state,
    setState,
    status,
    active,
    allProfiles,
    reload,
    profileList,
    isDuo,
    hasPartner,
    canAddPartner: isDuo && !hasPartner,
    mainNeedsPinSetup,
    switchProfile,
    addPartner,
    renameProfile,
    removePartner,
    verifyPin,
    setProfilePin,
  };
}
