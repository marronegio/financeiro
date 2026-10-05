import { describe, it, expect } from 'vitest';
import { migrateState, createDefaultState } from './state.js';

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
