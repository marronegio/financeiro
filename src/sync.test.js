import { describe, it, expect, vi } from 'vitest';
import { migrateState } from './state.js';
import {
  same,
  diffProfile,
  mergeLists,
  rebaseProfiles,
  createSyncEngine,
} from './sync.js';

const blob = (profiles) => migrateState({ v: 2, profiles });
const p = (data, name = 'Você') => ({ name, data });

const compra = (nome, valor = '10,00') => ({ nome, valor, cat: '' });
const nomes = (lista) => lista.map((it) => it.nome);

describe('same', () => {
  it('ignora a ordem das chaves (o jsonb devolve noutra ordem)', () => {
    expect(same({ a: 1, b: [1, { c: 2, d: 3 }] }, { b: [1, { d: 3, c: 2 }], a: 1 })).toBe(true);
  });

  it('chave a mais com valor conta como diferença', () => {
    expect(same({ a: null, b: 1 }, { b: 1, z: 1 })).toBe(false);
  });

  it('undefined e ausente são a mesma coisa', () => {
    expect(same({ a: 1, b: undefined }, { a: 1 })).toBe(true);
  });
});

describe('diffProfile', () => {
  const base = blob({ main: p({ salario: '1000', tab: 'plan' }) }).profiles.main;

  it('trocar de aba não é edição', () => {
    expect(diffProfile(base, { ...base, data: { ...base.data, tab: 'cartao' } })).toBeNull();
  });

  it('sobe só o campo que mudou', () => {
    const local = { ...base, data: { ...base.data, salario: '2000' } };
    expect(diffProfile(base, local)).toEqual({ data: { salario: '2000' }, meta: {} });
  });

  it('PIN apagado sobe como null', () => {
    const comPin = { ...base, pin: '1234' };
    expect(diffProfile(comPin, base)).toEqual({ data: {}, meta: { pin: null } });
  });
});

describe('mergeLists', () => {
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((n) => compra(n));

  it('edição aqui e inclusão lá: as duas ficam, no lugar', () => {
    const b2 = { ...b, valor: '99,00' };
    expect(mergeLists([a, b, c], [a, b2, c], [a, b, c, d])).toEqual([a, b2, c, d]);
  });

  it('cada lado edita um item diferente', () => {
    const a2 = { ...a, valor: '1,00' };
    const c2 = { ...c, valor: '3,00' };
    expect(mergeLists([a, b, c], [a2, b, c], [a, b, c2])).toEqual([a2, b, c2]);
  });

  it('os dois lançam no fim: nenhum lançamento se perde', () => {
    expect(nomes(mergeLists([a, b], [a, b, c], [a, b, d])).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('apagado aqui, incluído lá', () => {
    expect(mergeLists([a, b], [b], [a, b, d])).toEqual([b, d]);
  });

  it('dois itens iguais (dois Uber de 10,00) continuam dois', () => {
    const merged = mergeLists([a], [a, a], [a, d]);
    expect(merged.filter((x) => same(x, a))).toHaveLength(2);
    expect(merged).toContainEqual(d);
  });

  it('o mesmo item editado dos dois jeitos fica duas vezes, para a pessoa escolher', () => {
    const aqui = { ...a, valor: '1,00' };
    const la = { ...a, valor: '2,00' };
    const merged = mergeLists([a, b], [aqui, b], [la, b]);
    expect(merged).toContainEqual(aqui);
    expect(merged).toContainEqual(la);
    expect(merged).toContainEqual(b);
  });
});

describe('rebaseProfiles', () => {
  it('o que o outro aparelho gravou chega aqui', () => {
    const base = blob({ main: p({ salario: '1000' }) });
    const remoto = blob({ main: p({ salario: '2000' }) });
    expect(rebaseProfiles(base, base.profiles, remoto).profiles.main.data.salario).toBe('2000');
  });

  it('nada mudou: devolve o mesmo objeto, sem repintar a tela', () => {
    const local = blob({ main: p({ salario: '1000' }) });
    const remoto = blob({ main: p({ salario: '1000' }) });
    expect(rebaseProfiles(local, local.profiles, remoto)).toBe(local);
  });

  it('não apaga a digitação que ainda não subiu', () => {
    const base = blob({ main: p({ salario: '1000' }) });
    const local = blob({ main: p({ salario: '1500' }) });
    expect(rebaseProfiles(local, base.profiles, base).profiles.main.data.salario).toBe('1500');
  });

  it('edição pendente num campo não segura o perfil inteiro (o bug do notebook)', () => {
    // O notebook tinha só trocado de aba e mexido no salário; o desktop lançou
    // uma compra. Antes, qualquer pendência fazia o perfil local inteiro ficar.
    const base = blob({ main: p({ salario: '1000', cartao: [compra('Mercado')] }) });
    const local = blob({ main: p({ salario: '1500', tab: 'cartao', cartao: [compra('Mercado')] }) });
    const remoto = blob({ main: p({ salario: '1000', cartao: [compra('Mercado'), compra('Uber')] }) });
    const d = rebaseProfiles(local, base.profiles, remoto).profiles.main.data;
    expect(d.salario).toBe('1500');
    expect(nomes(d.cartao)).toEqual(['Mercado', 'Uber']);
    expect(d.tab).toBe('cartao');
  });

  it('a aba aberta é de cada aparelho: navegar lá não muda a tela daqui', () => {
    const base = blob({ main: p({ tab: 'plan', salario: '1000' }) });
    const local = blob({ main: p({ tab: 'historico', salario: '1000' }) });
    const remoto = blob({ main: p({ tab: 'despesas', salario: '2000' }) });
    const d = rebaseProfiles(local, base.profiles, remoto).profiles.main.data;
    expect(d.tab).toBe('historico');
    expect(d.salario).toBe('2000');
  });

  it('só a aba diferente não conta como mudança', () => {
    const local = blob({ main: p({ tab: 'historico', salario: '1000' }) });
    const remoto = blob({ main: p({ tab: 'despesas', salario: '1000' }) });
    expect(rebaseProfiles(local, remoto.profiles, remoto)).toBe(local);
  });

  it('parceiro criado em outro aparelho aparece; apagado lá some daqui', () => {
    const so = blob({ main: p({}) });
    const casal = blob({ main: p({}), partner: p({ salario: '900' }, 'Ana') });
    expect(rebaseProfiles(so, so.profiles, casal).profiles.partner.data.salario).toBe('900');
    expect(rebaseProfiles(casal, casal.profiles, so).profiles.partner).toBeUndefined();
  });

  it('parceiro apagado lá, mas com edição daqui por subir, fica', () => {
    const casal = blob({ main: p({}), partner: p({ salario: '900' }, 'Ana') });
    const editado = blob({ main: p({}), partner: p({ salario: '950' }, 'Ana') });
    const so = blob({ main: p({}) });
    expect(rebaseProfiles(editado, casal.profiles, so).profiles.partner.data.salario).toBe('950');
  });

  it('parceiro recém-criado aqui não some com a releitura', () => {
    const so = blob({ main: p({}) });
    const local = blob({ main: p({}), partner: p({ salario: '900' }, 'Ana') });
    expect(rebaseProfiles(local, so.profiles, so).profiles.partner.name).toBe('Ana');
  });

  it('parceiro apagado aqui não ressuscita com a releitura', () => {
    const casal = blob({ main: p({}), partner: p({ salario: '900' }, 'Ana') });
    const local = blob({ main: p({}) });
    expect(rebaseProfiles(local, casal.profiles, casal).profiles.partner).toBeUndefined();
  });

  it('o perfil principal nunca some, mesmo se o servidor vier sem ele', () => {
    const local = blob({ main: p({ salario: '1000' }) });
    const merged = rebaseProfiles(local, local.profiles, { v: 2, profiles: {} });
    expect(merged.profiles.main.data.salario).toBe('1000');
  });

  it('primeira carga (sem estado local) usa o que veio inteiro', () => {
    const remoto = blob({ main: p({ salario: '2000' }) });
    expect(rebaseProfiles(null, {}, remoto)).toBe(remoto);
  });
});

// ── Dois aparelhos, um servidor ─────────────────────────────────────────────
// O servidor de mentira faz o mesmo que as funções SQL (save_profile e
// patch_profile, migração 20261004000000) e devolve os dados como a rede
// devolveria: cópia nova, com as chaves em outra ordem (o jsonb reordena).

const sortKeys = (x) =>
  Array.isArray(x)
    ? x.map(sortKeys)
    : x && typeof x === 'object'
      ? Object.fromEntries(Object.keys(x).sort().reverse().map((k) => [k, sortKeys(x[k])]))
      : x;
const wire = (x) => (x == null ? x : sortKeys(JSON.parse(JSON.stringify(x))));

const putFields = (obj, patch) => {
  const out = { ...obj };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = v;
  }
  return out;
};

function servidor(profiles) {
  let state = wire({ v: 2, profiles });
  let falhas = 0;
  let gate = null;
  return {
    get main() {
      return state.profiles.main.data;
    },
    get state() {
      return state;
    },
    falharLeituras(n) {
      falhas = n;
    },
    // A próxima leitura só volta quando a função devolvida for chamada.
    segurarLeitura() {
      let soltar;
      gate = new Promise((r) => { soltar = r; });
      return () => { gate = null; soltar(); };
    },
    api({ semPatch = false } = {}) {
      return {
        async fetch() {
          if (gate) await gate;
          if (falhas > 0) {
            falhas -= 1;
            throw new Error('Failed to fetch');
          }
          return wire(state);
        },
        async saveBlob(b) {
          state = wire(b);
        },
        async saveProfile(pid, pdata) {
          if (!pdata) {
            delete state.profiles[pid];
            return;
          }
          const rev = (state.profiles[pid]?.rev ?? 0) + 1;
          state.profiles[pid] = { ...wire(pdata), rev };
        },
        async patchProfile(pid, baseRev, data, meta) {
          if (semPatch) throw Object.assign(new Error('função não existe'), { code: 'PGRST202' });
          const cur = state.profiles[pid];
          if (!cur) return { ok: false, profile: null };
          const rev = cur.rev ?? 0;
          if (rev !== baseRev) return { ok: false, profile: wire(cur) };
          const { data: _d, rev: _r, ...m } = wire(meta);
          state.profiles[pid] = { ...putFields(cur, m), data: putFields(cur.data, wire(data)), rev: rev + 1 };
          return { ok: true, rev: rev + 1 };
        },
      };
    },
  };
}

function aparelho(srv, opts) {
  let raw = null;
  const engine = createSyncEngine({
    api: srv.api(opts),
    getRaw: () => raw,
    update: (fn) => { raw = fn(raw); },
  });
  return {
    engine,
    get raw() {
      return raw;
    },
    get main() {
      return raw.profiles.main.data;
    },
    abre: () => engine.pull(),
    salva: () => engine.flush(),
    // O mesmo caminho do setState do useProfiles.
    edita(fn, pid = 'main') {
      raw = { ...raw, profiles: { ...raw.profiles, [pid]: { ...raw.profiles[pid], data: fn(raw.profiles[pid].data) } } };
      engine.markDirty(pid);
    },
    mexeNosPerfis(fn, pid) {
      raw = fn(raw);
      engine.markDirty(pid);
    },
  };
}

// O APK 1.4.1, ainda instalado nos celulares: lê uma vez ao abrir e grava o
// perfil inteiro a cada edição.
function aparelhoAntigo(srv) {
  const api = srv.api();
  let raw;
  return {
    async abre() {
      raw = migrateState(await api.fetch());
    },
    async edita(fn) {
      raw.profiles.main = { ...raw.profiles.main, data: fn(raw.profiles.main.data) };
      await api.saveProfile('main', raw.profiles.main);
    },
  };
}

const lanca = (nome) => (d) => ({ ...d, cartao: [...d.cartao, compra(nome)] });

describe('sincronização entre aparelhos', () => {
  it('notebook com a tela velha que só troca de aba não grava nada', async () => {
    const srv = servidor({ main: p({ cartao: [compra('Mercado')] }) });
    const desktop = aparelho(srv);
    const notebook = aparelho(srv);
    await desktop.abre();
    await notebook.abre();

    desktop.edita(lanca('Uber'));
    await desktop.salva();

    // O notebook acordou e a pessoa foi direto para Despesas.
    notebook.edita((d) => ({ ...d, tab: 'cartao' }));
    await notebook.salva();
    expect(nomes(srv.main.cartao)).toEqual(['Mercado', 'Uber']);

    await notebook.abre();
    expect(nomes(notebook.main.cartao)).toEqual(['Mercado', 'Uber']);
    expect(notebook.main.tab).toBe('cartao');
  });

  it('notebook com a tela velha lança uma compra: as duas ficam', async () => {
    const srv = servidor({ main: p({ salario: '5000', cartao: [compra('Mercado')] }) });
    const desktop = aparelho(srv);
    const notebook = aparelho(srv);
    await desktop.abre();
    await notebook.abre();

    desktop.edita(lanca('Uber'));
    desktop.edita((d) => ({ ...d, salario: '5200' }));
    await desktop.salva();

    notebook.edita(lanca('Farmácia'));
    await notebook.salva();

    expect(nomes(srv.main.cartao).sort()).toEqual(['Farmácia', 'Mercado', 'Uber']);
    expect(srv.main.salario).toBe('5200');
    expect(nomes(notebook.main.cartao).sort()).toEqual(['Farmácia', 'Mercado', 'Uber']);
    expect(notebook.main.salario).toBe('5200');
  });

  it('edição feita enquanto a releitura está em voo não se perde', async () => {
    const srv = servidor({ main: p({ salario: '5000', cartao: [compra('Mercado')] }) });
    const desktop = aparelho(srv);
    const notebook = aparelho(srv);
    await desktop.abre();
    await notebook.abre();

    desktop.edita((d) => ({ ...d, salario: '6000' }));
    await desktop.salva();

    const soltar = srv.segurarLeitura();
    const releitura = notebook.abre();
    await new Promise((r) => setTimeout(r, 0));
    notebook.edita(lanca('Padaria'));
    soltar();
    await releitura;
    await notebook.salva();

    expect(srv.main.salario).toBe('6000');
    expect(nomes(srv.main.cartao)).toEqual(['Mercado', 'Padaria']);
    expect(notebook.main.salario).toBe('6000');
  });

  it('primeira leitura falhou: o perfil em branco não sobe por cima da conta', async () => {
    const srv = servidor({ main: p({ salario: '5000', cartao: [compra('Mercado'), compra('Uber')] }) });
    const notebook = aparelho(srv);
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});

    srv.falharLeituras(1); // abriu antes do Wi-Fi conectar
    await expect(notebook.abre()).rejects.toThrow();
    expect(notebook.main.salario).toBe(''); // tela em branco, com o aviso de offline
    notebook.edita((d) => ({ ...d, tab: 'cartao' }));
    notebook.edita(lanca('Café'));
    await notebook.salva();
    expect(nomes(srv.main.cartao)).toEqual(['Mercado', 'Uber']); // nada subiu
    expect(srv.main.salario).toBe('5000');

    // A rede voltou: o que foi lançado offline entra por cima dos dados de verdade.
    expect(await notebook.abre()).toBe(true);
    await notebook.salva();
    expect(srv.main.salario).toBe('5000');
    expect(nomes(srv.main.cartao)).toContain('Mercado');
    expect(nomes(srv.main.cartao)).toContain('Uber');
    expect(nomes(srv.main.cartao)).toContain('Café');
    expect(notebook.main.salario).toBe('5000');
    erro.mockRestore();
  });

  it('o app antigo do celular gravou o perfil inteiro: o novo percebe e não apaga o que ele lançou', async () => {
    const srv = servidor({ main: p({ salario: '5000', cartao: [compra('Mercado')] }) });
    const celular = aparelhoAntigo(srv);
    const notebook = aparelho(srv);
    await celular.abre();
    await notebook.abre();

    await celular.edita((d) => ({ ...d, salario: '7000' }));
    notebook.edita(lanca('Farmácia'));
    await notebook.salva();

    expect(srv.main.salario).toBe('7000');
    expect(nomes(srv.main.cartao)).toEqual(['Mercado', 'Farmácia']);
  });

  it('mês fechado no desktop enquanto o notebook lançava: a compra nova vai para o mês novo', async () => {
    const srv = servidor({ main: p({ cartao: [compra('Mercado'), compra('Uber')], historico: [] }) });
    const desktop = aparelho(srv);
    const notebook = aparelho(srv);
    await desktop.abre();
    await notebook.abre();

    desktop.edita((d) => ({
      ...d,
      cartao: [{ nome: '', valor: '', cat: '' }],
      historico: [{ periodo: '2026-09', gasto: 20 }],
    }));
    await desktop.salva();

    notebook.edita(lanca('Farmácia'));
    await notebook.salva();

    expect(nomes(srv.main.cartao).filter(Boolean)).toEqual(['Farmácia']);
    expect(srv.main.historico).toEqual([{ periodo: '2026-09', gasto: 20 }]);
  });

  it('banco sem patch_profile (migração não rodou): grava o perfil inteiro, como antes', async () => {
    const srv = servidor({ main: p({ salario: '5000' }) });
    const notebook = aparelho(srv, { semPatch: true });
    await notebook.abre();
    notebook.edita((d) => ({ ...d, salario: '5100' }));
    await notebook.salva();
    expect(srv.main.salario).toBe('5100');

    // Mesmo assim, trocar de aba não grava.
    const rev = srv.state.profiles.main.rev;
    notebook.edita((d) => ({ ...d, tab: 'historico' }));
    await notebook.salva();
    expect(srv.state.profiles.main.rev).toBe(rev);
  });

  it('parceiro criado aqui sobe; apagado aqui some do servidor', async () => {
    const srv = servidor({ main: p({ salario: '5000' }) });
    const notebook = aparelho(srv);
    await notebook.abre();

    notebook.mexeNosPerfis(
      (r) => ({ ...r, profiles: { ...r.profiles, partner: { name: 'Ana', data: { ...r.profiles.main.data, salario: '900' } } } }),
      'partner',
    );
    await notebook.salva();
    expect(srv.state.profiles.partner.data.salario).toBe('900');

    // Editar o parceiro depois de criado (o rev é desconhecido até aqui).
    notebook.edita((d) => ({ ...d, salario: '950' }), 'partner');
    await notebook.salva();
    expect(srv.state.profiles.partner.data.salario).toBe('950');

    notebook.mexeNosPerfis(({ profiles: { partner, ...rest }, ...r }) => ({ ...r, profiles: rest }), 'partner');
    await notebook.salva();
    expect(srv.state.profiles.partner).toBeUndefined();
    expect(srv.main.salario).toBe('5000');
  });

  it('a versão anda a cada gravação', async () => {
    const srv = servidor({ main: p({ salario: '5000' }) });
    const notebook = aparelho(srv);
    await notebook.abre();
    notebook.edita((d) => ({ ...d, salario: '1' }));
    await notebook.salva();
    notebook.edita((d) => ({ ...d, salario: '2' }));
    await notebook.salva();
    expect(srv.state.profiles.main.rev).toBe(2);
    expect(srv.main.salario).toBe('2');
  });
});
