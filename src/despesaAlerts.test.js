import { describe, it, expect } from 'vitest';
import { nextDueDate, computeDespesaAlerts } from './despesaAlerts.js';

// 15 de junho de 2026 (mês index 5).
const TODAY = new Date(2026, 5, 15);

describe('nextDueDate', () => {
  it('usa o vencimento deste mês quando ainda não passou', () => {
    expect(nextDueDate('20', TODAY)).toEqual(new Date(2026, 5, 20));
  });

  it('joga para o mês seguinte quando o vencimento já passou', () => {
    expect(nextDueDate('10', TODAY)).toEqual(new Date(2026, 6, 10));
  });

  it('usa o vencimento de hoje (faltam 0 dias)', () => {
    expect(nextDueDate('15', TODAY)).toEqual(new Date(2026, 5, 15));
  });

  it('limita dias além do fim do mês ao último dia (31 em fevereiro)', () => {
    const feb = new Date(2026, 1, 1);
    expect(nextDueDate('31', feb)).toEqual(new Date(2026, 1, 28));
  });

  it('ignora vencimento inválido', () => {
    expect(nextDueDate('', TODAY)).toBeNull();
    expect(nextDueDate('0', TODAY)).toBeNull();
    expect(nextDueDate('99', TODAY)).toBeNull();
  });
});

describe('computeDespesaAlerts', () => {
  it('dispara em 3, 1 e 0 dias antes — e não em 2', () => {
    const despesas = [
      { nome: 'Tres', valor: '', venc: '18' }, // faltam 3
      { nome: 'Dois', valor: '', venc: '17' }, // faltam 2 (sem alerta)
      { nome: 'Um', valor: '', venc: '16' }, // falta 1
      { nome: 'Hoje', valor: '', venc: '15' }, // hoje
      { nome: 'Longe', valor: '', venc: '25' }, // faltam 10 (sem alerta)
    ];
    const nomes = computeDespesaAlerts(despesas, TODAY).map((a) => a.nome);
    expect(nomes).toEqual(['Tres', 'Um', 'Hoje']);
  });

  it('expõe os dias restantes e o período do vencimento', () => {
    const [a] = computeDespesaAlerts([{ nome: 'Luz', venc: '16' }], TODAY);
    expect(a.daysUntil).toBe(1);
    expect(a.duePeriod).toBe('2026-06');
    expect(a.idx).toBe(0);
  });

  it('suprime quando já marcada como paga no período do vencimento', () => {
    const despesas = [{ nome: 'Luz', venc: '16', pago: '2026-06' }];
    expect(computeDespesaAlerts(despesas, TODAY)).toHaveLength(0);
  });

  it('volta a avisar se o "pago" é de outro período', () => {
    const despesas = [{ nome: 'Luz', venc: '16', pago: '2026-05' }];
    expect(computeDespesaAlerts(despesas, TODAY)).toHaveLength(1);
  });
});
