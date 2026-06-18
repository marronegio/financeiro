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

  const addPartner = useCallback(() => {
    setRaw((r) => {
      if (!r || !isDuoRef.current || r.profiles.partner) return r;
      return {
        ...r,
        activeProfile: 'partner',
        profiles: {
          ...r.profiles,
          partner: { name: PROFILE_NAMES.partner, data: createDefaultState() },
        },
      };
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

  // Lista para o seletor. O parceiro só aparece dentro do plano Duo.
  const profileList = raw
    ? [
        { id: 'main', name: raw.profiles.main.name, avatar: raw.profiles.main.data.avatar },
        ...(isDuo && raw.profiles.partner
          ? [{ id: 'partner', name: raw.profiles.partner.name, avatar: raw.profiles.partner.data.avatar }]
          : []),
      ]
    : [];

  return {
    state,
    setState,
    status,
    active,
    profileList,
    isDuo,
    hasPartner,
    canAddPartner: isDuo && !hasPartner,
    switchProfile,
    addPartner,
    renameProfile,
    removePartner,
  };
}
