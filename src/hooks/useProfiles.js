import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { supabase } from '../lib/supabase.js';
import { isNativeApp } from '../lib/native.js';
import { createDefaultState, PROFILE_NAMES } from '../state.js';
import { createSyncEngine } from '../sync.js';

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

// ── Aba aberta também é POR DISPOSITIVO ───────────────────────────────────
// Ela mora no blob por acidente de história, mas não sobe mais para a nuvem
// (ver LOCAL_ONLY em sync.js). Para o app ainda reabrir onde a pessoa parou,
// cada aparelho guarda a sua aqui.
const tabKey = (userId, pid) => `dinprev-tab:${userId}:${pid}`;

function storeTab(userId, pid, tab) {
  try {
    localStorage.setItem(tabKey(userId, pid), tab);
  } catch {
    /* sem localStorage o app só reabre na aba que veio da nuvem */
  }
}

function withStoredTabs(raw, userId) {
  if (!raw) return raw;
  const profiles = {};
  for (const [id, p] of Object.entries(raw.profiles)) {
    let tab = null;
    try {
      tab = localStorage.getItem(tabKey(userId, id));
    } catch {
      /* idem */
    }
    profiles[id] = tab && tab !== p.data.tab ? { ...p, data: { ...p.data, tab } } : p;
  }
  return { ...raw, profiles };
}

// O que o motor de sincronização (sync.js) precisa do Supabase.
function supabaseApi(userId, getRaw) {
  const saveBlob = async (state) => {
    const { error } = await supabase
      .from('finances')
      .upsert({ user_id: userId, state, updated_at: new Date().toISOString() });
    if (error) throw error;
  };
  return {
    async fetch() {
      const { data, error } = await supabase
        .from('finances')
        .select('state')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data?.state;
    },
    saveBlob,
    async saveProfile(pid, pdata) {
      const { error } = await supabase.rpc('save_profile', { pid, pdata });
      if (!error) return;
      // Função ainda não criada no banco (rode supabase/schema.sql): cai no
      // upsert do blob inteiro — comportamento antigo, funcional porém sem
      // proteção contra edição simultânea.
      if (error.code === 'PGRST202') return saveBlob(getRaw());
      throw error;
    },
    async patchProfile(pid, baseRev, dataPatch, metaPatch) {
      const { data, error } = await supabase.rpc('patch_profile', {
        pid,
        base_rev: baseRev,
        data_patch: dataPatch,
        meta_patch: metaPatch,
      });
      if (error) throw error;
      return data;
    },
  };
}

// Expõe o estado financeiro do PERFIL ATIVO com o mesmo contrato de sempre
// (`state` + `setState`), mais a gestão de perfis do plano Duo.
//
// Persistência: cada alteração grava APENAS os campos que mudaram no perfil
// alterado, e só se o servidor ainda estiver na versão de onde a edição partiu
// — o resto (mescla com o outro aparelho, ordem das gravações) mora em sync.js.
export function useProfiles(userId, planTier) {
  const [raw, setRawState] = useState(null); // blob completo { v, profiles }
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [activeLocal, setActiveLocal] = useState(() => readStoredActive(userId));

  const isDuo = planTier === 'duo';

  // Refs para callbacks estáveis (o Dashboard depende da identidade de setState).
  const isDuoRef = useRef(isDuo);
  isDuoRef.current = isDuo;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // O blob mora neste ref e o React recebe cópias. Gravação e releitura leem
  // daqui, nunca do último render: uma releitura que chegou e ainda não pintou
  // seria lida pela gravação seguinte como "edição daqui" e subiria por cima do
  // servidor. Por isso também nada de updater do React — cada mudança é aplicada
  // na hora, em cima da anterior.
  const rawRef = useRef(null);
  const update = useCallback((fn) => {
    const cur = rawRef.current;
    const next = fn(cur);
    if (next === cur) return;
    rawRef.current = next;
    setRawState(next);
  }, []);

  // O perfil pedido só vale se existir (e o Duo estiver ativo); senão, 'main'.
  const active =
    activeLocal === 'partner' && isDuo && raw?.profiles?.partner ? 'partner' : 'main';
  const activeRef = useRef(active);
  activeRef.current = active;

  // Um motor por conta: trocar de usuário começa do zero (base, fila, tudo). O
  // de uma conta anterior que ainda tenha algo em voo não enxerga nem mexe na
  // tela da conta nova.
  const engineRef = useRef(null);
  const engine = useMemo(() => {
    if (!userId) return null;
    const own = () => engineRef.current === e;
    const getRaw = () => (own() ? rawRef.current : null);
    const e = createSyncEngine({
      api: supabaseApi(userId, getRaw),
      getRaw,
      update: (fn) => { if (own()) update(fn); },
    });
    return e;
  }, [userId, update]);
  engineRef.current = engine;

  // ── Fila de gravação ──────────────────────────────────────────────────────
  const saveTimer = useRef(null);

  const flush = useCallback(() => {
    clearTimeout(saveTimer.current);
    return engine ? engine.flush() : Promise.resolve();
  }, [engine]);

  const queueSave = useCallback((pid) => {
    engine?.markDirty(pid);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 600);
  }, [engine, flush]);

  // Grava o que estiver pendente ao desmontar/trocar de usuário.
  useEffect(() => () => { flush(); }, [flush]);

  // ── Carregamento ──────────────────────────────────────────────────────────
  // Se a primeira leitura falha (notebook que abriu antes do Wi-Fi conectar),
  // a tela fica num perfil em branco com o aviso de offline, e NADA é gravado
  // até uma releitura dar certo — antes, o primeiro toque gravava o perfil em
  // branco por cima da conta. A releitura vem pelos mesmos gatilhos de sempre
  // (volta da rede, foco, a conferida periódica).
  useEffect(() => {
    if (!engine) return;
    let alive = true;
    setStatus('loading');
    setActiveLocal(readStoredActive(userId));
    update(() => null);

    engine.pull().then(
      () => {
        if (!alive) return;
        update((r) => withStoredTabs(r, userId));
        setStatus('ready');
      },
      (err) => {
        if (!alive) return;
        console.error('Falha ao carregar dados:', err);
        setStatus('error');
      }
    );

    return () => { alive = false; };
  }, [engine, userId, update]);

  // ── Chegada de fora ───────────────────────────────────────────────────────
  // Rebusca o blob (o outro perfil, ou o outro aparelho, pode ter editado) e
  // encaixa na tela sem atropelar o que ainda não subiu daqui.
  const reload = useCallback(async () => {
    if (!engine) return;
    try {
      // true = era a primeira leitura que dava certo (depois de uma falha).
      if (await engine.pull()) setStatus('ready');
    } catch (err) {
      console.error('Falha ao atualizar dados:', err);
    }
  }, [engine]);

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

  // Escreve apenas no perfil ativo. Aceita updater (função) ou valor. Trocar
  // de aba passa por aqui, mas não vira gravação: o motor só sobe campo que
  // mudou, e a aba não viaja.
  const setState = useCallback((updater) => {
    update((r) => {
      if (!r) return r;
      const id = activeRef.current;
      const cur = r.profiles[id].data;
      const next = typeof updater === 'function' ? updater(cur) : updater;
      if (next === cur) return r; // no-op (ex.: rollover sem nada a fechar)
      if (next.tab !== cur.tab) storeTab(userIdRef.current, id, next.tab);
      queueSave(id);
      return { ...r, profiles: { ...r.profiles, [id]: { ...r.profiles[id], data: next } } };
    });
  }, [update, queueSave]);

  const switchProfile = useCallback((id) => {
    if (id === 'partner' && !(isDuoRef.current && rawRef.current?.profiles?.partner)) return;
    storeActive(userIdRef.current, id);
    setActiveLocal(id);
    reload();
  }, [reload]);

  // Cria o perfil do parceiro e o torna ativo NESTE dispositivo.
  const addPartner = useCallback((opts = {}) => {
    update((r) => {
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
  }, [update, queueSave]);

  // Confere o PIN de um perfil. Perfil sem PIN é sempre liberado.
  const verifyPin = useCallback((id, pin) => {
    const p = rawRef.current?.profiles?.[id];
    if (!p) return false;
    if (!p.pin) return true;
    return p.pin === pin;
  }, []);

  // Define (4 dígitos) ou remove (vazio) o PIN de um perfil.
  const setProfilePin = useCallback((id, pin) => {
    update((r) => {
      if (!r || !r.profiles[id]) return r;
      const p = { ...r.profiles[id] };
      if (pin) p.pin = pin;
      else delete p.pin;
      if (id === 'main') p.pinPrompted = true;
      queueSave(id);
      return { ...r, profiles: { ...r.profiles, [id]: p } };
    });
  }, [update, queueSave]);

  const renameProfile = useCallback((id, name) => {
    update((r) => {
      if (!r || !r.profiles[id]) return r;
      queueSave(id);
      return { ...r, profiles: { ...r.profiles, [id]: { ...r.profiles[id], name } } };
    });
  }, [update, queueSave]);

  const removePartner = useCallback(() => {
    update((r) => {
      if (!r || !r.profiles.partner) return r;
      const { partner, ...rest } = r.profiles;
      queueSave('partner'); // ausente no blob → o flush apaga no servidor
      return { ...r, profiles: rest };
    });
    storeActive(userIdRef.current, 'main');
    setActiveLocal('main');
  }, [update, queueSave]);

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
