import { describe, it, expect } from 'vitest';
import { migrateState, mergeRemoteProfiles, createDefaultState } from './state.js';

const main = (raw) => migrateState(raw).profiles.main.data;

describe('migrateState', () => {
  it('conta nova nasce sem dia de fechamento e com o automático desligado', () => {
    expect(main(null).fechamentoDia).toBe('');
    expect(main(null).fechamentoAuto).toBe(false);
    expect(createDefaultState().fechamentoDia).toBe('');
    expect(createDefaultState().fechamentoAuto).toBe(false);
  });

  it('quem já fechava no dia do recebimento herda o dia e segue no automático', () => {
    // Blob antigo (v1, plano) e blob v2: nos dois o ciclo tem que continuar rodando.
    expect(main({ recebimentoDia: '7' })).toMatchObject({
      fechamentoDia: '7',
      fechamentoAuto: true,
    });
    expect(
      migrateState({ v: 2, profiles: { main: { name: 'Você', data: { recebimentoDia: '7' } } } })
        .profiles.main.data,
    ).toMatchObject({ fechamentoDia: '7', fechamentoAuto: true });
  });

  it('quem já desligou o automático continua desligado', () => {
    expect(main({ recebimentoDia: '7', fechamentoAuto: false }).fechamentoAuto).toBe(false);
  });

  it('não sobrescreve um dia de fechamento já escolhido', () => {
    expect(main({ recebimentoDia: '7', fechamentoDia: '20' }).fechamentoDia).toBe('20');
  });

  it('o campo antigo continua no blob (não some da conta de quem já tinha)', () => {
    expect(main({ recebimentoDia: '7' }).recebimentoDia).toBe('7');
  });

  it('preenche campos novos em perfis salvos antes deles existirem', () => {
    const d = main({ salario: '1.000,00' });
    expect(d.salario).toBe('1.000,00');
    // sem ciclo antigo (nunca teve dia de recebimento), fica no padrão novo
    expect(d.fechamentoAuto).toBe(false);
    expect(d.doacoes).toEqual([{ nome: '', valor: '', recorrente: false }]);
  });
});

describe('mergeRemoteProfiles', () => {
  const blob = (profiles) => migrateState({ v: 2, profiles });
  const p = (data, name = 'Você') => ({ name, data });
  const nada = () => false;

  it('o que o outro aparelho gravou chega aqui', () => {
    const local = blob({ main: p({ salario: '1000' }) });
    const remoto = blob({ main: p({ salario: '2000' }) });
    expect(mergeRemoteProfiles(local, remoto, nada).profiles.main.data.salario).toBe('2000');
  });

  it('nada mudou: devolve o mesmo objeto, sem repintar a tela', () => {
    const local = blob({ main: p({ salario: '1000' }) });
    const remoto = blob({ main: p({ salario: '1000' }) });
    expect(mergeRemoteProfiles(local, remoto, nada)).toBe(local);
  });

  it('não apaga a digitação que ainda não subiu', () => {
    const local = blob({ main: p({ salario: '1500' }) });
    const remoto = blob({ main: p({ salario: '1000' }) }); // servidor ainda no valor antigo
    const meu = (id) => id === 'main';
    expect(mergeRemoteProfiles(local, remoto, meu).profiles.main.data.salario).toBe('1500');
  });

  it('a aba aberta é de cada aparelho: navegar lá não muda a tela daqui', () => {
    const local = blob({ main: p({ tab: 'historico', salario: '1000' }) });
    const remoto = blob({ main: p({ tab: 'despesas', salario: '2000' }) });
    const merged = mergeRemoteProfiles(local, remoto, nada).profiles.main.data;
    expect(merged.tab).toBe('historico');
    expect(merged.salario).toBe('2000');
  });

  it('só a aba diferente não conta como mudança', () => {
    const local = blob({ main: p({ tab: 'historico', salario: '1000' }) });
    const remoto = blob({ main: p({ tab: 'despesas', salario: '1000' }) });
    expect(mergeRemoteProfiles(local, remoto, nada)).toBe(local);
  });

  it('parceiro criado em outro aparelho aparece; apagado lá some daqui', () => {
    const so = blob({ main: p({}) });
    const casal = blob({ main: p({}), partner: p({ salario: '900' }, 'Ana') });
    expect(mergeRemoteProfiles(so, casal, nada).profiles.partner.data.salario).toBe('900');
    expect(mergeRemoteProfiles(casal, so, nada).profiles.partner).toBeUndefined();
  });

  it('parceiro recém-criado aqui não some com a releitura', () => {
    const local = blob({ main: p({}), partner: p({ salario: '900' }, 'Ana') });
    const remoto = blob({ main: p({}) }); // a criação ainda não subiu
    const meu = (id) => id === 'partner';
    expect(mergeRemoteProfiles(local, remoto, meu).profiles.partner.name).toBe('Ana');
  });

  it('parceiro apagado aqui não ressuscita com a releitura', () => {
    const local = blob({ main: p({}) });
    const remoto = blob({ main: p({}), partner: p({ salario: '900' }, 'Ana') });
    const meu = (id) => id === 'partner';
    expect(mergeRemoteProfiles(local, remoto, meu).profiles.partner).toBeUndefined();
  });

  it('o perfil principal nunca some, mesmo se o servidor vier sem ele', () => {
    const local = blob({ main: p({ salario: '1000' }) });
    const meu = (id) => id === 'main';
    const merged = mergeRemoteProfiles(local, { v: 2, profiles: {} }, meu);
    expect(merged.profiles.main.data.salario).toBe('1000');
  });

  it('primeira carga (sem estado local) usa o que veio inteiro', () => {
    const remoto = blob({ main: p({ salario: '2000' }) });
    expect(mergeRemoteProfiles(null, remoto, nada)).toBe(remoto);
  });
});
