import { migrateState, migrateProfile } from './state.js';

// ── Sincronização entre aparelhos ───────────────────────────────────────────
// Cada aparelho guarda, além do que mostra na tela, a BASE de cada perfil: o
// último retrato que ele sabe estar no servidor. Toda gravação e toda releitura
// olham para três versões — base, local (a tela) e remoto (o servidor) — como
// num merge do git:
//
//   - campo que só mudou de um lado: vale esse lado;
//   - campo que mudou dos dois: listas se juntam item a item (mergeLists);
//     valores soltos (o salário, o dia do fechamento) ficam com o daqui, que é
//     a edição que a pessoa acabou de fazer.
//
// Até aqui o app gravava o PERFIL INTEIRO e, ao reler, segurava o perfil local
// inteiro se houvesse qualquer coisa pendente. Bastava um aparelho com a tela
// velha — o notebook que acordou da suspensão, o app aberto há dias no celular —
// tocar em qualquer coisa (trocar de aba contava: ela morava no perfil) para o
// perfil velho subir por cima do que o outro aparelho tinha gravado.
//
// Agora sobe só o campo que mudou, e só se o perfil no servidor ainda estiver na
// versão (`rev`) de onde a edição partiu (ver patch_profile na migração
// 20261004000000). Se outro aparelho gravou no meio, nada é gravado: a edição
// daqui é encaixada por cima do que está lá e a gravação tenta de novo.

// Campos que não viajam entre aparelhos. A aba aberta é escolha de cada um:
// navegar no desktop não pode trocar a tela do notebook, e navegar num
// aparelho com a tela velha não pode virar gravação.
const LOCAL_ONLY = ['tab'];

// Igualdade por conteúdo. O servidor (jsonb) devolve as chaves em outra ordem,
// então JSON.stringify não serve. `undefined` e `null` contam como "sem valor"
// — o primeiro nem sobrevive à ida pela rede.
export const same = (a, b) => {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!same(a[k], b[k])) return false;
  }
  return true;
};

// ── O que sobe ───────────────────────────────────────────────────────────────

const changedFields = (base = {}, local = {}, skip) => {
  const out = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(local)])) {
    if (skip.includes(k) || same(base[k], local[k])) continue;
    out[k] = local[k] ?? null; // null = campo removido (ex.: PIN apagado)
  }
  return out;
};

// Campos do perfil que mudaram desde a base: `data` são os dados financeiros,
// `meta` o resto (nome, PIN). null quando não há nada a gravar.
export const diffProfile = (base, local) => {
  const data = changedFields(base.data, local.data, LOCAL_ONLY);
  const meta = changedFields(base, local, ['data', 'rev']);
  return Object.keys(data).length || Object.keys(meta).length ? { data, meta } : null;
};

const putFields = (obj, patch) => {
  const out = { ...obj };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = v;
  }
  return out;
};

// A base depois de o servidor aceitar o patch: o mesmo que ele aplicou lá.
export const applyPatch = (base, patch, rev) => ({
  ...putFields(base, patch.meta),
  data: putFields(base.data, patch.data),
  rev,
});

// ── Como o que chega se encaixa ──────────────────────────────────────────────

// Pares [i, j] da maior subsequência comum entre duas listas.
const lcs = (a, b) => {
  const n = a.length;
  const m = b.length;
  const eq = a.map((x) => b.map((y) => same(x, y)));
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = eq[i][j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pairs = [];
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (eq[i][j]) pairs.push([i++, j++]);
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
};

// Multiconjunto: tira de `list` um item igual para cada item de `remove`.
const without = (list, remove) => {
  const out = [...list];
  for (const x of remove) {
    const i = out.findIndex((y) => same(x, y));
    if (i >= 0) out.splice(i, 1);
  }
  return out;
};

// Junta duas edições da mesma lista (compras, despesas fixas, metas…). Os
// itens não têm id, então a identidade é o conteúdo: os itens que nenhum dos
// dois lados mexeu servem de âncora, e entre duas âncoras cada trecho fica com
// o lado que mudou. Mudou dos dois lados: entra o que o remoto tem, menos o que
// foi apagado aqui, mais o que foi incluído aqui.
//
// Na dúvida nada some. Item editado aqui e apagado lá volta (com a edição);
// o mesmo item editado dos dois jeitos fica duas vezes, para a pessoa escolher.
export const mergeLists = (base = [], local = [], remote = []) => {
  const inLocal = new Map(lcs(base, local));
  const inRemote = new Map(lcs(base, remote));
  const out = [];
  let b = 0;
  let l = 0;
  let r = 0;
  const trecho = (bEnd, lEnd, rEnd) => {
    const bc = base.slice(b, bEnd);
    const lc = local.slice(l, lEnd);
    const rc = remote.slice(r, rEnd);
    if (same(lc, bc)) out.push(...rc);
    else if (same(rc, bc) || same(lc, rc)) out.push(...lc);
    else out.push(...without(rc, without(bc, lc)), ...without(lc, bc));
  };
  for (let i = 0; i < base.length; i++) {
    if (!inLocal.has(i) || !inRemote.has(i)) continue;
    const li = inLocal.get(i);
    const ri = inRemote.get(i);
    trecho(i, li, ri);
    out.push(local[li]);
    b = i + 1;
    l = li + 1;
    r = ri + 1;
  }
  trecho(base.length, local.length, remote.length);
  return out;
};

const mergeField = (b, l, r) => {
  // Igual dos dois lados: fica o objeto daqui, para a tela não repintar à toa.
  if (same(l, r)) return l;
  if (same(l, b)) return r;
  if (same(r, b)) return l;
  if (Array.isArray(l) && Array.isArray(r)) return mergeLists(Array.isArray(b) ? b : [], l, r);
  return l;
};

const mergeFields = (base = {}, local = {}, remote = {}, skip) => {
  const out = {};
  for (const k of new Set([...Object.keys(remote), ...Object.keys(local)])) {
    if (skip.includes(k)) continue;
    const v = mergeField(base[k], local[k], remote[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
};

// O perfil local reescrito por cima do remoto: o que mudou aqui desde a base
// continua valendo, o resto vem do servidor. A aba é sempre a daqui.
export const rebaseProfile = (base, local, remote) => {
  const out = {
    ...mergeFields(base, local, remote, ['data', 'rev']),
    data: { ...mergeFields(base.data, local.data, remote.data, LOCAL_ONLY), tab: local.data.tab },
  };
  if (remote.rev !== undefined) out.rev = remote.rev;
  return out;
};

const withProfile = (raw, pid, profile) => ({ ...raw, profiles: { ...raw.profiles, [pid]: profile } });

// Encaixa no estado da tela (`cur`) o blob que veio do servidor (`incoming`),
// dada a base de onde a tela partiu. `cur` e `incoming` já vêm de migrateState.
// Devolve `cur` quando nada mudou, para a tela não repintar a cada aviso.
export const rebaseProfiles = (cur, base, incoming) => {
  if (!cur) return incoming;
  const profiles = {};
  for (const id of new Set([...Object.keys(incoming.profiles), ...Object.keys(cur.profiles)])) {
    const local = cur.profiles[id];
    const remote = incoming.profiles[id];
    const b = base?.[id];
    if (local && remote) {
      profiles[id] = b ? rebaseProfile(b, local, remote) : local;
    } else if (remote) {
      // Sem cópia local e com base: foi APAGADO aqui e a remoção ainda não
      // subiu — deixar o que veio do servidor entrar o ressuscitaria.
      if (!b) profiles[id] = remote;
    } else if (local) {
      // Apagado em outro aparelho some daqui também, a não ser que tenha edição
      // daqui por subir (ou tenha acabado de ser criado aqui).
      if (!b || diffProfile(b, local)) profiles[id] = local;
    }
  }
  // 'main' nunca some: sem ele o Dashboard fica sem estado para mostrar.
  if (!profiles.main) profiles.main = cur.profiles.main;
  const next = { ...incoming, profiles };
  return same(next, cur) ? cur : next;
};

// ── O motor ──────────────────────────────────────────────────────────────────
// Fora do React de propósito: o que importa aqui é a ordem das coisas, e ela
// precisa ser testável com dois "aparelhos" falando com um servidor de mentira.
//
//   api.fetch()                         → blob do servidor (ou undefined)
//   api.saveBlob(blob)                  → grava o blob inteiro (conta nova / v1)
//   api.saveProfile(pid, pdata|null)    → grava/apaga o perfil inteiro
//   api.patchProfile(pid, rev, data, meta) → { ok, rev } | { ok: false, profile }
//
// `getRaw` lê o estado da tela e `update(fn)` o troca NA HORA (não no próximo
// render): uma releitura que acabou de chegar e ainda não pintou não pode ser
// lida pela gravação seguinte como se fosse edição daqui.
export function createSyncEngine({ api, getRaw, update }) {
  let base = {};
  let pending = new Set();
  let loaded = false;
  let legacy = false; // banco sem patch_profile (migração não rodou): grava como antes
  let chain = Promise.resolve();

  // Tudo que conversa com o servidor passa em fila, um por vez: uma releitura
  // no meio de uma gravação trocaria a base debaixo dela.
  const serial = (task) => {
    const run = chain.then(task);
    chain = run.catch(() => {});
    return run;
  };

  const saveWhole = async (pid, local) => {
    await api.saveProfile(pid, local ?? null);
    if (local) base[pid] = local;
    else delete base[pid];
  };

  async function writeProfile(pid) {
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const local = getRaw()?.profiles[pid];
      const b = base[pid];
      if (!local && !b) return;
      // Criar e apagar o perfil do parceiro seguem gravando o perfil inteiro.
      if (!local || !b) return saveWhole(pid, local);

      const patch = diffProfile(b, local);
      if (!patch) return;
      if (legacy) return saveWhole(pid, local);
      let res;
      try {
        res = await api.patchProfile(pid, b.rev ?? 0, patch.data, patch.meta);
      } catch (err) {
        if (err?.code !== 'PGRST202') throw err;
        legacy = true;
        continue;
      }
      if (res.ok) {
        base[pid] = applyPatch(b, patch, res.rev);
        return;
      }
      // Outro aparelho gravou neste perfil depois da nossa base. Perfil que
      // sumiu de lá volta com o que temos aqui (a edição daqui manda).
      if (!res.profile) {
        delete base[pid];
        continue;
      }
      const remote = migrateProfile(res.profile);
      base[pid] = remote;
      update((raw) => (raw?.profiles[pid] ? withProfile(raw, pid, rebaseProfile(b, raw.profiles[pid], remote)) : raw));
    }
    throw new Error(`perfil ${pid} mudou em outro aparelho a cada tentativa de salvar`);
  }

  const markDirty = (pid) => {
    pending.add(pid);
  };

  // Sobe o que está pendente. Antes da primeira leitura bem-sucedida não sobe
  // nada: a tela está mostrando um perfil em branco, e gravá-lo apagaria a conta.
  const flush = () =>
    serial(async () => {
      if (!loaded || pending.size === 0 || !getRaw()) return;
      const fila = pending;
      pending = new Set();
      for (const pid of fila) {
        try {
          await writeProfile(pid);
        } catch (err) {
          console.error('Falha ao salvar perfil:', err);
          // Fica na fila: sobe na próxima edição, na volta da rede ou do foco.
          pending.add(pid);
        }
      }
    });

  // Lê o servidor e encaixa na tela. Grava o pendente antes (fica na fila na
  // frente da busca). A primeira leitura é também o carregamento; se ela falha,
  // a tela fica num perfil em branco que vira a base — o que a pessoa lançar
  // ali é encaixado por cima dos dados de verdade quando a rede voltar.
  // Devolve true na leitura que deixou o app pronto.
  const pull = () => {
    flush();
    return serial(async () => {
      let db;
      try {
        db = await api.fetch();
      } catch (err) {
        if (!loaded && !getRaw()) {
          const vazio = migrateState(undefined);
          base = { ...vazio.profiles };
          update(() => vazio);
        }
        throw err;
      }
      if (loaded && db?.v !== 2) return false;
      const incoming = migrateState(db);
      // Conta nova ou blob antigo (v1): a gravação por perfil precisa do
      // caminho profiles.* já existente na linha.
      if (!db || db.v !== 2) {
        await api.saveBlob(incoming).catch((err) => console.error('Falha ao normalizar dados:', err));
      }
      const antes = base;
      base = { ...incoming.profiles };
      update((cur) => rebaseProfiles(cur, antes, incoming));
      if (loaded) return false;
      loaded = true;
      if (pending.size) flush();
      return true;
    });
  };

  return { markDirty, flush, pull };
}
