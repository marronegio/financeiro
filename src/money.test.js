import { describe, it, expect } from 'vitest';
import { BRL, maskMoney, toNumber, onlyDigits, computeParcela, compute } from './money.js';

describe('BRL', () => {
  it('formata como real brasileiro', () => {
    const s = BRL(1234.5);
    expect(s).toMatch(/^R\$/);
    expect(s).toContain('1.234,50');
  });

  it('formata zero', () => {
    expect(BRL(0)).toContain('0,00');
  });

  it('valores não-finitos viram 0', () => {
    expect(BRL(NaN)).toContain('0,00');
    expect(BRL(Infinity)).toContain('0,00');
  });

  it('valor negativo mantém o sinal', () => {
    expect(BRL(-50)).toContain('50,00');
    expect(BRL(-50)).toMatch(/-/);
  });
});

describe('maskMoney', () => {
  it('trata os dígitos como centavos', () => {
    expect(maskMoney('1234')).toBe('12,34');
    expect(maskMoney('100')).toBe('1,00');
    expect(maskMoney('5')).toBe('0,05');
  });

  it('agrupa milhares', () => {
    expect(maskMoney('123456')).toBe('1.234,56');
  });

  it('ignora caracteres não numéricos', () => {
    expect(maskMoney('R$ 1.234,56')).toBe('1.234,56');
  });

  it('string vazia / sem dígitos vira string vazia', () => {
    expect(maskMoney('')).toBe('');
    expect(maskMoney('abc')).toBe('');
  });
});

describe('toNumber', () => {
  it('converte texto mascarado em número', () => {
    expect(toNumber('12,34')).toBe(12.34);
    expect(toNumber('R$ 1.234,56')).toBe(1234.56);
    expect(toNumber('1.000,00')).toBe(1000);
  });

  it('vazio / inválido vira 0', () => {
    expect(toNumber('')).toBe(0);
    expect(toNumber('abc')).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });
});

describe('onlyDigits', () => {
  it('mantém apenas dígitos', () => {
    expect(onlyDigits('a1b2c3')).toBe('123');
    expect(onlyDigits('12/2026')).toBe('122026');
    expect(onlyDigits('')).toBe('');
  });
});

describe('computeParcela', () => {
  it('calcula parcela em andamento', () => {
    const p = computeParcela({ total: '616,80', parcelas: '12', pagas: '3' });
    expect(p.total).toBeCloseTo(616.8, 2);
    expect(p.parc).toBe(12);
    expect(p.pagas).toBe(3);
    expect(p.mensal).toBeCloseTo(51.4, 2);
    expect(p.restantes).toBe(9);
    expect(p.falta).toBeCloseTo(462.6, 2);
    expect(p.pct).toBe(25);
    expect(p.done).toBe(false);
  });

  it('marca como quitado e limita "pagas" ao total de parcelas', () => {
    const p = computeParcela({ total: '100,00', parcelas: '4', pagas: '20' });
    expect(p.pagas).toBe(4);
    expect(p.restantes).toBe(0);
    expect(p.falta).toBe(0);
    expect(p.pct).toBe(100);
    expect(p.done).toBe(true);
  });

  it('nº de parcelas ausente zera tudo (sem dividir por zero)', () => {
    const p = computeParcela({ total: '100,00', parcelas: '', pagas: '' });
    expect(p.parc).toBe(0);
    expect(p.mensal).toBe(0);
    expect(p.falta).toBe(0);
    expect(p.pct).toBe(0);
    expect(p.done).toBe(false);
  });

  it('"pagas" negativo é tratado como 0', () => {
    const p = computeParcela({ total: '100,00', parcelas: '10', pagas: '-3' });
    expect(p.pagas).toBe(0);
    expect(p.restantes).toBe(10);
  });
});

describe('compute', () => {
  const baseState = () => ({
    salario: '1.000,00',
    guardar: '100,00',
    split: 40,
    despesas: [{ nome: 'Aluguel', valor: '200,00' }],
    assinaturas: [{ nome: 'Spotify', valor: '50,00' }],
    cartao: [{ nome: 'Mercado', valor: '30,00' }],
    parcelamentos: [{ nome: 'Notebook', total: '120,00', parcelas: '12', pagas: '0' }],
  });

  it('agrega totais, fatura, sobra e divisão crédito/débito', () => {
    const c = compute(baseState());
    expect(c.salario).toBe(1000);
    expect(c.guardar).toBe(100);
    expect(c.totDesp).toBe(200);
    expect(c.totAss).toBe(50);
    expect(c.totCartao).toBe(30);
    expect(c.parcelaMensal).toBeCloseTo(10, 2);
    expect(c.parcelaAtivas).toBe(1);
    expect(c.parcelaRestante).toBeCloseTo(120, 2);
    expect(c.faturaCartao).toBeCloseTo(90, 2); // cartão 30 + assinaturas 50 + parcela 10
    expect(c.gastos).toBeCloseTo(290, 2); // 200 + 50 + 30 + 10
    expect(c.sobra).toBeCloseTo(610, 2); // 1000 - 290 - 100
    expect(c.pctC).toBe(40);
    expect(c.pctD).toBe(60);
    expect(c.credito).toBeCloseTo(244, 2); // 610 * 40%
    expect(c.debito).toBeCloseTo(366, 2); // 610 * 60%
  });

  it('parcela via Pix entra nos gastos mas fica fora da fatura', () => {
    const s = baseState();
    s.parcelamentos.push({ nome: 'Passagem', total: '60,00', parcelas: '6', pagas: '0', pix: true });
    const c = compute(s);
    expect(c.parcelaMensal).toBeCloseTo(20, 2); // 10 cartão + 10 pix
    expect(c.parcelaMensalCartao).toBeCloseTo(10, 2);
    expect(c.parcelaMensalPix).toBeCloseTo(10, 2);
    expect(c.faturaCartao).toBeCloseTo(90, 2); // pix não entra na fatura
    expect(c.gastos).toBeCloseTo(300, 2); // 290 + 10 do pix
    expect(c.parcelaAtivas).toBe(2);
  });

  it('parcelamento quitado não entra na parcela do mês', () => {
    const s = baseState();
    s.parcelamentos = [{ nome: 'Quitado', total: '120,00', parcelas: '12', pagas: '12' }];
    const c = compute(s);
    expect(c.parcelaMensal).toBe(0);
    expect(c.parcelaAtivas).toBe(0);
    expect(c.faturaCartao).toBeCloseTo(80, 2); // cartão 30 + assinaturas 50
  });

  it('abates reduzem a fatura e os gastos', () => {
    const s = baseState();
    s.abates = [{ nome: 'Estorno', valor: '40,00' }];
    const c = compute(s);
    expect(c.totAbates).toBeCloseTo(40, 2);
    expect(c.faturaCartao).toBeCloseTo(50, 2); // 30 + 50 + 10 − 40
    expect(c.gastos).toBeCloseTo(250, 2); // 290 − 40
    expect(c.sobra).toBeCloseTo(650, 2); // 1000 − 250 − 100
  });

  it('sem abates, totAbates é 0', () => {
    expect(compute(baseState()).totAbates).toBe(0);
  });

  it('renda extra soma à renda disponível e aumenta a sobra', () => {
    const s = baseState();
    s.rendaExtra = [{ nome: 'Freela', valor: '300,00' }, { nome: 'Venda', valor: '50,00' }];
    const c = compute(s);
    expect(c.totRendaExtra).toBeCloseTo(350, 2);
    expect(c.sobra).toBeCloseTo(960, 2); // 1000 + 350 − 290 − 100
    expect(c.gastos).toBeCloseTo(290, 2); // renda extra não mexe nos gastos
  });

  it('sem renda extra, totRendaExtra é 0', () => {
    expect(compute(baseState()).totRendaExtra).toBe(0);
  });

  it('sobra negativa zera crédito e débito (não usa valor negativo)', () => {
    const s = baseState();
    s.salario = '100,00'; // gastos passam do salário
    const c = compute(s);
    expect(c.sobra).toBeLessThan(0);
    expect(c.credito).toBe(0);
    expect(c.debito).toBe(0);
  });
});
