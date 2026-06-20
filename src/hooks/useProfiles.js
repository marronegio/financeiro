import { useCallback, useRef } from 'react';
import { useCloudState } from './useCloudState.js';
import { createDefaultProfiles, migrateState, createDefaultState, PROFILE_NAMES } from '../state.js';

// Resolve qual perfil está ativo de fato. Fora do plano Duo (ou sem parceiro
// cadastrado) o ativo é sempre 'main' — assim os dados do parceiro continuam
// salvos no banco, apenas ocultos, e voltam ao reativar o Duo.
function resolveActive(raw, isDuo) {
  if (isDuo && raw?.activeProfile === 'partner' && raw?.profiles?.partner) return 'partner';
  return 'main';
}

// Camada sobre useCloudState que expõe o estado financeiro do PERFIL ATIVO com a
// mesma forma/contrato de antes (`state` + `setState`), mais a gestão de perfis
// do plano Duo. O Dashboard e os painéis continuam consumindo `state`/`setState`
// sem saber que há mais de um perfil por baixo.
export function useProfiles(userId, planTier) {
  const [raw, setRaw, status] = useCloudState(userId, createDefaultProfiles, migrateState);

  const isDuo = planTier === 'duo';
  // Refs para manter as callbacks estáveis (o Dashboard depende da identidade de
  // setState em um useEffect de rollover).
  const isDuoRef = useRef(isDuo);
  isDuoRef.current = isDuo;

  // Ref do blob cru para leituras síncronas (ex.: conferir PIN num clique) sem
  // depender da closure do render.
  const rawRef = useRef(raw);
  rawRef.current = raw;

  const active = resolveActive(raw, isDuo);
  const hasPartner = !!raw?.profiles?.partner;
  const state = raw ? raw.profiles[active].data : null;

  // Escreve de volta apenas no perfil ativo. Aceita updater (função) ou valor,
  // espelhando a API do setState do React que o Dashboard já usa.
  const setState = useCallback((updater) => {
    setRaw((r) => {
      if (!r) return r;
      const id = resolveActive(r, isDuoRef.current);
      const cur = r.profiles[id].data;
      const next = typeof updater === 'function' ? updater(cur) : updater;
      return { ...r, profiles: { ...r.profiles, [id]: { ...r.profiles[id], data: next } } };
    });
  }, [setRaw]);

  const switchProfile = useCallback((id) => {
    setRaw((r) => {
      if (!r) return r;
      if (id === 'partner' && !(isDuoRef.current && r.profiles.partner)) return r;
      return { ...r, activeProfile: id };
    });
  }, [setRaw]);

  // Cria o perfil do parceiro e já o torna ativo. Aceita nome, foto e PIN
  // opcionais (vindos da tela de seleção estilo Netflix); sem nome, cai no padrão.
  const addPartner = useCallback((opts = {}) => {
    setRaw((r) => {
      if (!r || !isDuoRef.current || r.profiles.partner) return r;
      const data = createDefaultState();
      if (opts.avatar) data.avatar = opts.avatar;
      const partner = { name: opts.name?.trim() || PROFILE_NAMES.partner, data };
      if (opts.pin) partner.pin = opts.pin; // PIN opcional de 4 dígitos
      return {
        ...r,
        activeProfile: 'partner',
        profiles: { ...r.profiles, partner },
      };
    });
  }, [setRaw]);

  // Confere o PIN de um perfil. Perfil sem PIN é sempre liberado.
  const verifyPin = useCallback((id, pin) => {
    const p = rawRef.current?.profiles?.[id];
    if (!p) return false;
    if (!p.pin) return true;
    return p.pin === pin;
  }, []);

  // Define (pin com 4 dígitos) ou remove (pin vazio) o PIN de um perfil. Usado
  // pela oferta de "primeiro login", pela tela de Configurações e pela
  // recuperação. No principal, marca pinPrompted pra não repetir a oferta.
  const setProfilePin = useCallback((id, pin) => {
    setRaw((r) => {
      if (!r || !r.profiles[id]) return r;
      const p = { ...r.profiles[id] };
      if (pin) p.pin = pin;
      else delete p.pin;
      if (id === 'main') p.pinPrompted = true;
      return { ...r, profiles: { ...r.profiles, [id]: p } };
    });
  }, [setRaw]);

  const renameProfile = useCallback((id, name) => {
    setRaw((r) => {
      if (!r || !r.profiles[id]) return r;
      return { ...r, profiles: { ...r.profiles, [id]: { ...r.profiles[id], name } } };
    });
  }, [setRaw]);

  const removePartner = useCallback(() => {
    setRaw((r) => {
      if (!r || !r.profiles.partner) return r;
      const { partner, ...rest } = r.profiles;
      return { ...r, activeProfile: 'main', profiles: rest };
    });
  }, [setRaw]);

  // Lista para o seletor. O parceiro só aparece dentro do plano Duo. `hasPin`
  // diz ao gate quais perfis pedem PIN antes de entrar (sem expor o PIN em si).
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
