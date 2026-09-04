import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { createDefaultProfiles, migrateState, createDefaultState, PROFILE_NAMES } from '../state.js';
import { onAppStateChange } from '../lib/native.js';

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
  // true quando a última tentativa de gravar falhou. A tela já avisava quando o
  // CARREGAMENTO falhava, mas a falha ao SALVAR ficava só no console: o mês
  // fechado seguia na tela como se estivesse guardado, e só no outro aparelho a
  // pessoa descobria que nunca foi.
  const [saveError, setSaveError] = useState(false);

  const flush = useCallback(async () => {
    clearTimeout(saveTimer.current);
    const pending = pendingRef.current;
    if (pending.size === 0 || !userIdRef.current) return;
    pendingRef.current = new Set();

    const blob = rawRef.current;
    if (!blob) return;

    // Gravação que falhou volta para a fila e é tentada de novo — sozinha em
    // alguns segundos, e junto da próxima edição/volta para o app. Sem isso um
    // segundo de rede ruim perdia a alteração em silêncio.
    let falha = false;
    const falhou = (pid) => {
      pendingRef.current.add(pid);
      falha = true;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, 10000);
    };

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
        if (upErr) {
          console.error('Falha ao salvar dados:', upErr);
          falhou(pid);
        }
        setSaveError(falha);
        return;
      }
      console.error('Falha ao salvar perfil:', error);
      falhou(pid);
    }

    setSaveError(falha);
  }, []);

  // `immediate` pula a espera de 600ms. Vale para o que não pode se perder se o
  // app morrer no segundo seguinte (fechar mês, desfazer fechamento); a digitação
  // continua agrupada, senão seria uma gravação por tecla.
  const queueSave = useCallback((pid, immediate) => {
    pendingRef.current.add(pid);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, immediate ? 0 : 600);
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

  // Rebusca o blob (o outro perfil pode ter sido editado em outro aparelho).
  // Grava o pendente antes, para o fetch já voltar com as nossas mudanças.
  const reload = useCallback(async () => {
    try {
      await flush();
      // Sobrou coisa na fila (a gravação falhou): trazer o servidor por cima
      // apagaria justamente a alteração que ainda não subiu. Fica com o que está
      // aqui até conseguir salvar.
      if (pendingRef.current.size > 0) return;
      const dbState = await fetchBlob();
      if (dbState?.v === 2) setRawState(migrateState(dbState));
    } catch (err) {
      console.error('Falha ao atualizar dados:', err);
    }
  }, [flush, fetchBlob]);

  // ── Sair de cena grava; voltar recarrega ──────────────────────────────────
  // O debounce não sobrevive ao app indo para segundo plano (o WebView congela e
  // pode ser encerrado pelo sistema) nem à aba sendo fechada: a alteração ficava
  // na tela e nunca chegava ao servidor. E na volta é preciso rebuscar o blob —
  // uma aba aberta há horas guarda um estado velho e, na primeira edição,
  // regravaria o perfil inteiro por cima do que foi feito no celular.
  useEffect(() => {
    if (!userId) return;
    let escondido = false;

    const aoEsconder = () => {
      escondido = true;
      flush();
    };
    const aoVoltar = () => {
      if (!escondido) return; // ignora eventos repetidos (visibility + Capacitor)
      escondido = false;
      reload();
    };
    const onVisibility = () =>
      document.visibilityState === 'hidden' ? aoEsconder() : aoVoltar();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', aoEsconder);
    const offAppState = onAppStateChange((ativo) => (ativo ? aoVoltar() : aoEsconder()));

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', aoEsconder);
      offAppState();
    };
  }, [userId, flush, reload]);

  // ── Mutações ──────────────────────────────────────────────────────────────

  // Escreve apenas no perfil ativo. Aceita updater (função) ou valor.
  // `opts.immediate` grava na hora, sem o debounce (ver queueSave).
  const setState = useCallback((updater, opts) => {
    setRawState((r) => {
      if (!r) return r;
      const id = activeRef.current;
      const cur = r.profiles[id].data;
      const next = typeof updater === 'function' ? updater(cur) : updater;
      if (next === cur) return r; // no-op (ex.: rollover sem nada a fechar)
      const nextRaw = { ...r, profiles: { ...r.profiles, [id]: { ...r.profiles[id], data: next } } };
      // O flush lê o blob por este ref, que normalmente só é atualizado no
      // render seguinte. Adiantar aqui garante que uma gravação imediata mande o
      // estado novo — e não o anterior, apagando justamente o que acabou de ser
      // feito (o ref é reescrito no render, então isto nunca fica dessincronizado).
      rawRef.current = nextRaw;
      queueSave(id, opts?.immediate);
      return nextRaw;
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
    saveError,
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
