import { describe, it, expect } from 'vitest';
import {
  fmtPeriodo,
  applyRollover,
  manualClose,
  totalGuardado,
  computeInsights,
} from './history.js';

// 15 de junho de 2026 (mês index 5). Com dia de recebimento 10, o período
// "devido" é '2026-06' (já passou do dia 10).
const TODAY = new Date(2026, 5, 15);

const baseState = (over = {}) => ({
  salario: '1.000,00',
  guardar: '100,00',
  split: 40,
  despesas: [{ nome: 'Aluguel', valor: '200,00' }],
  assinaturas: [{ nome: 'Spotify', valor: '50,00' }],
  cartao: [{ nome: 'Mercado', valor: '30,00' }],
  parcelamentos: [{ nome: 'Notebook', total: '120,00', parcelas: '12', pagas: '0' }],
  recebimentoDia: '10',
  faturaDia: '10',
  ultimoFechamento: '',
  historico: [],
  ...over,
});

describe('fmtPeriodo', () => {
  it('formata o período com mês e ano', () => {
    const s = fmtPeriodo('2026-06');
    expect(s).toMatch(/jun/i);
    expect(s).toContain('2026');
  });

  it('valor vazio vira travessão', () => {
    expect(fmtPeriodo('')).toBe('—');
    expect(fmtPeriodo(null)).toBe('—');
  });
});

describe('applyRollover', () => {
  it('sem dia de recebimento válido, retorna o MESMO objeto (no-op)', () => {
    const s = baseState({ recebimentoDia: '' });
    expect(applyRollover(s, TODAY)).toBe(s);
  });

  it('primeira vez apenas ancora o período, sem fechar nada', () => {
    const s = baseState({ ultimoFechamento: '' });
    const r = applyRollover(s, TODAY);
    expect(r).not.toBe(s);
    expect(r.ultimoFechamento).toBe('2026-06');
    expect(r.historico).toHaveLength(0); // nada foi fechado
  });

  it('quando já está no período devido, é no-op (mesma referência)', () => {
    const s = baseState({ ultimoFechamento: '2026-06' });
    expect(applyRollover(s, TODAY)).toBe(s);
  });

  it('fecha um mês pendente: salva resumo, zera cartão e avança parcela', () => {
    const s = baseState({ ultimoFechamento: '2026-05' });
    const r = applyRollover(s, TODAY);

    expect(r.ultimoFechamento).toBe('2026-06');
    expect(r.historico).toHaveLength(1);
    expect(r.historico[0].periodo).toBe('2026-06');
    expect(r.historico[0].gasto).toBeCloseTo(290, 2);
    expect(r.historico[0].guardado).toBeCloseTo(610, 2); // sobra real

    // cartão zerado
    expect(r.cartao).toEqual([{ nome: '', valor: '' }]);
    // renda extra zerada
    expect(r.rendaExtra).toEqual([{ nome: '', valor: '' }]);
    // parcela avançou 0 -> 1
    expect(r.parcelamentos[0].pagas).toBe('1');
    // não muta o estado original
    expect(s.parcelamentos[0].pagas).toBe('0');
    expect(s.historico).toHaveLength(0);
  });

  it('fecha vários meses perdidos de uma vez', () => {
    const s = baseState({ ultimoFechamento: '2026-03' });
    const r = applyRollover(s, TODAY);

    expect(r.historico.map((h) => h.periodo)).toEqual(['2026-04', '2026-05', '2026-06']);
    expect(r.ultimoFechamento).toBe('2026-06');
    // três fechamentos => parcela avança 3 (0 -> 3)
    expect(r.parcelamentos[0].pagas).toBe('3');
  });

  it('parcelamento quitado não avança além do total', () => {
    const s = baseState({
      ultimoFechamento: '2026-05',
      parcelamentos: [{ nome: 'Quase', total: '120,00', parcelas: '12', pagas: '12' }],
    });
    const r = applyRollover(s, TODAY);
    expect(r.parcelamentos[0].pagas).toBe('12');
  });
});

describe('totalGuardado', () => {
  it('soma o guardado de todos os meses (líquido)', () => {
    expect(totalGuardado([])).toBe(0);
    expect(totalGuardado([{ guardado: 100 }, { guardado: -30 }, { guardado: 50 }])).toBe(120);
  });

  it('ignora valores ausentes', () => {
    expect(totalGuardado([{ guardado: 100 }, {}, { guardado: 20 }])).toBe(120);
  });
});

describe('computeInsights', () => {
  it('sem histórico, não gera insights', () => {
    expect(computeInsights([])).toEqual([]);
  });

  it('com um mês, mostra o total acumulado', () => {
    const ins = computeInsights([{ periodo: '2026-05', gasto: 300, cartao: 100, guardado: 200 }]);
    expect(ins.length).toBe(1);
    expect(ins[0].tone).toBe('pos');
    expect(ins[0].text).toMatch(/total/i);
  });

  it('compara o último mês com o anterior', () => {
    const ins = computeInsights([
      { periodo: '2026-04', gasto: 200, cartao: 100, guardado: 100 },
      { periodo: '2026-05', gasto: 300, cartao: 150, guardado: 250 },
    ]);
    const txt = ins.map((i) => i.text).join(' ');
    expect(txt).toMatch(/a mais/);        // guardou mais
    expect(txt).toMatch(/subiram/);       // gastos subiram
    expect(txt).toMatch(/Média/);         // média mensal
  });
});

describe('manualClose', () => {
  it('fecha o mês atual independentemente da data', () => {
    const s = baseState({ ultimoFechamento: '' });
    const r = manualClose(s, TODAY);
    expect(r.historico).toHaveLength(1);
    expect(r.historico[0].periodo).toBe('2026-06');
    expect(r.ultimoFechamento).toBe('2026-06');
    expect(r.cartao).toEqual([{ nome: '', valor: '' }]);
    expect(r.parcelamentos[0].pagas).toBe('1');
  });

  it('zera a renda extra e a registra no resumo do mês', () => {
    const s = baseState({ rendaExtra: [{ nome: 'Freela', valor: '300,00' }] });
    const r = manualClose(s, TODAY);
    expect(r.rendaExtra).toEqual([{ nome: '', valor: '' }]);
    expect(r.historico[0].rendaExtra).toBeCloseTo(300, 2);
    // não muta o estado original
    expect(s.rendaExtra[0].valor).toBe('300,00');
  });

  it('usa o "guardado real" informado quando passado', () => {
    const s = baseState();
    const r = manualClose(s, TODAY, 999);
    expect(r.historico[0].guardado).toBe(999);
  });

  it('sem "guardado real", usa a sobra calculada', () => {
    const s = baseState();
    const r = manualClose(s, TODAY);
    expect(r.historico[0].guardado).toBeCloseTo(610, 2);
  });
});
