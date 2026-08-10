import { describe, it, expect } from 'vitest';
import {
  BRL, maskMoney, toNumber, onlyDigits, computeParcela, compute, sobraDoMes,
} from './money.js';

describe('sobraDoMes', () => {
  it('desconta o que foi guardado — sobra e poupança são coisas diferentes', () => {
    // Mês real de um usuário: guardou 100, sobraram 329,25.
    const h = { salario: 5464.52, rendaExtra: 305.34, gasto: 5340.61, guardado: 100 };
    expect(sobraDoMes(h)).toBeCloseTo(329.25, 2);
  });

  it('mês fechado no vermelho devolve valor negativo', () => {
    expect(sobraDoMes({ salario: 1000, gasto: 1500, guardado: 0 })).toBeCloseTo(-500, 2);
  });

  it('campos ausentes ou registro vazio valem 0', () => {
    expect(sobraDoMes({ salario: 500 })).toBeCloseTo(500, 2);
    expect(sobraDoMes(null)).toBe(0);
    expect(sobraDoMes({})).toBe(0);
  });
});

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
  // Mês fechado com uma sobra conhecida. O `guardado` nunca é zero de
  // propósito: se algum dia o orçamento voltar a ler esse campo por engano, os
  // testes que usam este helper quebram na hora.
  const mesFechado = (periodo, sobra, guardado = 100) => ({
    periodo,
    salario: 2000,
    rendaExtra: 0,
    gasto: 2000 - sobra - guardado,
    guardado,
  });

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
  });

  it('sem mês fechado, não há orçamento de débito', () => {
    const c = compute(baseState());
    expect(c.temOrcamentoDebito).toBe(false);
    expect(c.orcamentoDebito).toBe(0);
  });

  it('o orçamento do débito é a sobra do último mês fechado', () => {
    const s = baseState();
    s.historico = [
      { periodo: '2026-07', salario: 5000, rendaExtra: 0, gasto: 4000, guardado: 200 },
      // O mais recente é o que vale.
      { periodo: '2026-08', salario: 5464.52, rendaExtra: 305.34, gasto: 5340.61, guardado: 100 },
    ];
    const c = compute(s);
    expect(c.temOrcamentoDebito).toBe(true);
    expect(c.orcamentoDebito).toBeCloseTo(329.25, 2);
    expect(c.orcamentoDebitoPeriodo).toBe('2026-08');
  });

  it('o orçamento é o que SOBROU, não o que a pessoa guardou', () => {
    // Mês real: guardou 100, mas sobraram 329,25. O orçamento é 329,25 — usar
    // o campo `guardado` transformaria a poupança da pessoa no teto de gastos.
    const s = baseState();
    s.historico = [
      { periodo: '2026-08', salario: 5464.52, rendaExtra: 305.34, gasto: 5340.61, guardado: 100 },
    ];
    const c = compute(s);
    expect(c.orcamentoDebito).toBeCloseTo(329.25, 2);
    expect(c.orcamentoDebito).not.toBeCloseTo(100, 2);
  });

  it('o orçamento não encolhe conforme a pessoa gasta no mês corrente', () => {
    const s = baseState();
    s.historico = [mesFechado('2026-05', 300)];
    const antes = compute(s);
    s.debito = [{ nome: 'Mercado', valor: '100,00' }];
    const depois = compute(s);
    // A sobra do mês cai (o gasto é real), mas o orçamento é um fato do mês
    // passado: não se mexe. Só o "ainda cabe" desce.
    expect(depois.sobra).toBeCloseTo(antes.sobra - 100, 2);
    expect(depois.orcamentoDebito).toBeCloseTo(300, 2);
    expect(depois.debitoDisponivel).toBeCloseTo(200, 2);
  });

  it('mês fechado no vermelho não vira orçamento negativo', () => {
    const s = baseState();
    s.historico = [mesFechado('2026-05', -450)];
    const c = compute(s);
    expect(c.orcamentoDebito).toBe(0);
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

  it('gasto no débito entra nos gastos, mas fica fora da fatura e do limite', () => {
    const s = baseState();
    s.limiteCartao = '1.000,00';
    s.debito = [{ nome: 'Mercado', valor: '80,00' }, { nome: 'Uber', valor: '20,00' }];
    const c = compute(s);
    expect(c.totDebito).toBeCloseTo(100, 2);
    expect(c.gastos).toBeCloseTo(390, 2); // 290 + 100
    expect(c.sobra).toBeCloseTo(510, 2); // 1000 − 390 − 100
    expect(c.faturaCartao).toBeCloseTo(90, 2); // inalterada: débito não passa no cartão
    // 30 do cartão + 50 de assinaturas + 120 do saldo devedor das parcelas —
    // os 100 do débito não reservam limite nenhum.
    expect(c.limiteUsado).toBeCloseTo(200, 2);
  });

  it('sem lista de débito (perfil antigo), totDebito é 0', () => {
    expect(compute(baseState()).totDebito).toBe(0);
  });

  it('estourar o orçamento do débito deixa o disponível negativo', () => {
    const s = baseState();
    s.historico = [mesFechado('2026-05', 300)];
    s.debito = [{ nome: 'Viagem', valor: '900,00' }];
    const c = compute(s);
    expect(c.debitoDisponivel).toBeLessThan(0);
  });

  it('o que ainda cabe no débito nunca passa da sobra do mês corrente', () => {
    // Mês passado sobraram 800 (o orçamento). Mas o mês corrente está apertado:
    // renda 3.000, fixas 1.000, 1.000 no cartão e 700 no débito → sobram 300.
    const c = compute({
      salario: '3.000,00',
      guardar: '',
      despesas: [{ nome: 'Aluguel', valor: '1.000,00' }],
      assinaturas: [],
      cartao: [{ nome: 'Mercado', valor: '1.000,00' }],
      debito: [{ nome: 'Pix', valor: '700,00' }],
      parcelamentos: [],
      historico: [mesFechado('2026-05', 800)],
    });

    expect(c.sobra).toBeCloseTo(300, 2);
    expect(c.orcamentoDebito).toBeCloseTo(800, 2);
    expect(c.debitoOrcamentoRestante).toBeCloseTo(100, 2); // 800 − 700
    // Aqui o orçamento é mais apertado que a sobra: quem limita é ele.
    expect(c.debitoDisponivel).toBeCloseTo(100, 2);
    expect(c.debitoNoTeto).toBe(false);
  });

  it('mês corrente mais apertado que o anterior: quem limita é a sobra', () => {
    const c = compute({
      salario: '3.000,00',
      guardar: '',
      despesas: [{ nome: 'Aluguel', valor: '1.000,00' }],
      assinaturas: [],
      cartao: [{ nome: 'Mercado', valor: '1.500,00' }],
      debito: [{ nome: 'Pix', valor: '200,00' }],
      parcelamentos: [],
      historico: [mesFechado('2026-05', 800)],
    });

    expect(c.sobra).toBeCloseTo(300, 2); // 3.000 − 1.000 − 1.500 − 200
    expect(c.debitoOrcamentoRestante).toBeCloseTo(600, 2); // 800 − 200
    // O orçamento diria 600; o dinheiro que existe são 300. Vale o menor.
    expect(c.debitoDisponivel).toBeCloseTo(300, 2);
    expect(c.debitoNoTeto).toBe(true);
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

  it('mês no vermelho não deixa nada disponível no débito', () => {
    const s = baseState();
    s.salario = '100,00'; // gastos passam do salário
    s.historico = [mesFechado('2026-05', 800)];
    const c = compute(s);
    expect(c.sobra).toBeLessThan(0);
    // O orçamento do mês passado continua de pé, mas não há dinheiro no mês
    // corrente: o teto vira a sobra, negativa.
    expect(c.orcamentoDebito).toBeCloseTo(800, 2);
    expect(c.debitoDisponivel).toBeLessThan(0);
    expect(c.debitoNoTeto).toBe(true);
  });
});
