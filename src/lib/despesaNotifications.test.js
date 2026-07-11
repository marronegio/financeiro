import { describe, it, expect } from 'vitest';
import { buildVencimentoNotifications } from './despesaNotifications.js';
import { BRL } from '../money.js';

// Terça, 10/03/2026 às 08:00 — antes do horário de aviso (9h).
const NOW = new Date(2026, 2, 10, 8, 0, 0);

describe('buildVencimentoNotifications', () => {
  it('agenda "vence amanhã" (D-1) e "vence hoje" (D-0) às 9h', () => {
    const out = buildVencimentoNotifications(
      [{ nome: 'Aluguel', valor: '1.200,00', venc: '11' }],
      NOW,
      0
    );
    expect(out).toHaveLength(2);

    const [amanha, hoje] = out;
    expect(amanha.at).toEqual(new Date(2026, 2, 10, 9, 0, 0));
    expect(amanha.body).toBe(`Aluguel vence amanhã — ${BRL(1200)}.`);
    expect(hoje.at).toEqual(new Date(2026, 2, 11, 9, 0, 0));
    expect(hoje.body).toBe(`Aluguel vence hoje — ${BRL(1200)}.`);
  });

  it('não agenda nada para despesa marcada como paga no ciclo', () => {
    const out = buildVencimentoNotifications(
      [{ nome: 'Luz', valor: '200,00', venc: '11', pago: '2026-03' }],
      NOW,
      0
    );
    expect(out).toHaveLength(0);
  });

  it('despesa paga volta a avisar no mês seguinte', () => {
    const out = buildVencimentoNotifications(
      [{ nome: 'Luz', valor: '200,00', venc: '11', pago: '2026-03' }],
      NOW,
      1
    );
    expect(out).toHaveLength(2);
    expect(out[0].at).toEqual(new Date(2026, 3, 10, 9, 0, 0)); // D-1 de 11/04
    expect(out[1].at).toEqual(new Date(2026, 3, 11, 9, 0, 0)); // D-0 de 11/04
  });

  it('descarta avisos cujo horário já passou', () => {
    // Às 10h do dia do vencimento: D-1 (ontem 9h) e D-0 (hoje 9h) já passaram.
    const lateNow = new Date(2026, 2, 11, 10, 0, 0);
    const out = buildVencimentoNotifications(
      [{ nome: 'Internet', valor: '', venc: '11' }],
      lateNow,
      0
    );
    expect(out).toHaveLength(0);
  });

  it('agrupa contas do mesmo dia numa notificação só, somando os valores', () => {
    const out = buildVencimentoNotifications(
      [
        { nome: 'Aluguel', valor: '1.000,00', venc: '11' },
        { nome: 'Condomínio', valor: '500,00', venc: '11' },
      ],
      NOW,
      0
    );
    expect(out).toHaveLength(2);
    expect(out[0].title).toBe('2 contas vencem amanhã');
    expect(out[0].body).toBe(`Aluguel e Condomínio vencem amanhã — ${BRL(1500)}.`);
  });

  it('vencimento dia 31 cai no último dia de mês mais curto', () => {
    // Abril tem 30 dias: venc 31 → dia 30. Horizonte 1 mês a partir de 10/03.
    const out = buildVencimentoNotifications(
      [{ nome: 'Cartão', valor: '', venc: '31' }],
      NOW,
      1
    );
    const abril = out.filter((n) => n.at.getMonth() === 3);
    expect(abril.some((n) => n.at.getDate() === 30 && n.body.includes('hoje'))).toBe(true);
  });

  it('ignora despesa sem dia de vencimento e valor zero fica sem cifra', () => {
    const out = buildVencimentoNotifications(
      [
        { nome: 'Sem venc', valor: '100,00', venc: '' },
        { nome: 'Água', valor: '', venc: '12' },
      ],
      NOW,
      0
    );
    expect(out).toHaveLength(2);
    expect(out[0].body).toBe('Água vence amanhã.');
  });

  it('ids são estáveis e distintos por dia/tipo', () => {
    const a = buildVencimentoNotifications([{ nome: 'X', valor: '', venc: '11' }], NOW, 0);
    const b = buildVencimentoNotifications([{ nome: 'X', valor: '', venc: '11' }], NOW, 0);
    expect(a.map((n) => n.id)).toEqual(b.map((n) => n.id));
    expect(new Set(a.map((n) => n.id)).size).toBe(a.length);
  });
});
