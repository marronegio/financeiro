import { describe, it, expect } from 'vitest';
import {
  fmtPeriodo,
  applyRollover,
  manualClose,
  totalGuardado,
  computeInsights,
  resumoMes,
  setFechamentoDia,
  undoLastClose,
} from './history.js';

// 15 de junho de 2026 (mês index 5). Com dia de fechamento 10, o período
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
  fechamentoDia: '10',
  fechamentoAuto: true, // o padrão é desligado; estes testes são do ciclo automático
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
  it('sem dia de fechamento válido, retorna o MESMO objeto (no-op)', () => {
    const s = baseState({ fechamentoDia: '' });
    expect(applyRollover(s, TODAY)).toBe(s);
  });

  it('o dia do recebimento legado não manda no ciclo', () => {
    // Campo antigo, ainda presente em contas anteriores: quem decide é o fechamento (10).
    const s = baseState({ recebimentoDia: '20', ultimoFechamento: '2026-05' });
    expect(applyRollover(s, TODAY).historico).toHaveLength(1);
  });

  it('mês sem o dia escolhido fecha no último dia dele', () => {
    // Fechamento no 31, abril tem 30: no dia 30 de abril o mês já venceu.
    const s = baseState({ fechamentoDia: '31', ultimoFechamento: '2026-03' });
    const r = applyRollover(s, new Date(2026, 3, 30));
    expect(r.historico.map((h) => h.periodo)).toEqual(['2026-04']);
    // no dia 29 ainda não
    expect(applyRollover(s, new Date(2026, 3, 29)).historico).toHaveLength(0);
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
    // débito zerado também: as compras avulsas são do mês que fechou
    expect(r.debito).toEqual([{ nome: '', valor: '', cat: '' }]);
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

  it('com o fechamento automático desligado, não fecha nada — só ancora o período', () => {
    const s = baseState({ ultimoFechamento: '2026-03', fechamentoAuto: false });
    const r = applyRollover(s, TODAY);

    expect(r.historico).toHaveLength(0);
    expect(r.ultimoFechamento).toBe('2026-06'); // não fica devendo meses ao ligar
    expect(r.parcelamentos[0].pagas).toBe('0');
  });

  it('sem a opção ligada (o padrão), também não fecha nada', () => {
    const s = baseState({ ultimoFechamento: '2026-03', fechamentoAuto: undefined });
    expect(applyRollover(s, TODAY).historico).toHaveLength(0);
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

describe('undoLastClose', () => {
  const fechado = () =>
    manualClose(
      baseState({
        cartao: [
          { nome: 'Mercado', valor: '230,00', cat: 'alimentacao' },
          { nome: 'Uber', valor: '45,50' },
        ],
        debito: [{ nome: 'Farmácia', valor: '60,00', cat: 'saude' }],
        rendaExtra: [{ nome: 'Freela', valor: '300,00' }],
        despesas: [{ nome: 'Aluguel', valor: '200,00', venc: '10', pago: '2026-06' }],
        doacoes: [
          { nome: 'Igreja', valor: '100,00', recorrente: true },
          { nome: 'Vaquinha', valor: '50,00', recorrente: false },
        ],
      }),
      TODAY,
    );

  it('devolve as compras do cartão com a máscara e a categoria', () => {
    const r = undoLastClose(fechado());
    expect(r.cartao).toEqual([
      { nome: 'Mercado', valor: '230,00', cat: 'alimentacao' },
      { nome: 'Uber', valor: '45,50', cat: '' },
    ]);
    expect(r.rendaExtra).toEqual([{ nome: 'Freela', valor: '300,00' }]);
  });

  it('devolve também os gastos do débito', () => {
    const r = undoLastClose(fechado());
    expect(r.debito).toEqual([{ nome: 'Farmácia', valor: '60,00', cat: 'saude' }]);
  });

  it('tira o mês do histórico sem devolver a âncora (senão o app refecharia)', () => {
    const s = fechado();
    const r = undoLastClose(s);
    expect(r.historico).toHaveLength(0);
    expect(r.ultimoFechamento).toBe(s.ultimoFechamento);
    expect(applyRollover(r, TODAY)).toBe(r);
  });

  it('recua a parcela e devolve o "já paguei" da despesa fixa', () => {
    const r = undoLastClose(fechado());
    expect(r.parcelamentos[0].pagas).toBe('0');
    expect(r.despesas[0].pago).toBe('2026-06');
  });

  it('não duplica a doação recorrente, que sobreviveu ao fechamento', () => {
    const r = undoLastClose(fechado());
    const nomes = r.doacoes.map((d) => d.nome);
    expect(nomes.filter((n) => n === 'Igreja')).toHaveLength(1);
    expect(nomes).toContain('Vaquinha');
  });

  it('preserva o que foi lançado depois do fechamento', () => {
    const s = fechado();
    const comNovo = { ...s, cartao: [{ nome: 'Padaria', valor: '20,00', cat: '' }] };
    const r = undoLastClose(comNovo);
    expect(r.cartao.map((c) => c.nome)).toEqual(['Mercado', 'Uber', 'Padaria']);
  });

  it('parcelamento mexido depois do fechamento fica como o usuário deixou', () => {
    const s = fechado();
    const editado = { ...s, parcelamentos: [{ ...s.parcelamentos[0], pagas: '5' }] };
    expect(undoLastClose(editado).parcelamentos[0].pagas).toBe('5');
  });

  it('mês antigo sem detalhamento só sai do histórico', () => {
    const s = baseState({ historico: [{ periodo: '2026-05', gasto: 100, guardado: 50 }] });
    const r = undoLastClose(s);
    expect(r.historico).toHaveLength(0);
    expect(r.cartao).toEqual(s.cartao); // nada a repor
  });

  it('sem histórico, devolve o MESMO objeto', () => {
    const s = baseState();
    expect(undoLastClose(s)).toBe(s);
  });
});

describe('setFechamentoDia', () => {
  // Hoje é 15/06. Com dia 10 o período devido é '2026-06'; com dia 20, '2026-05'.
  it('baixar o dia NÃO fecha o mês — só re-ancora o ciclo', () => {
    const s = baseState({ fechamentoDia: '20', ultimoFechamento: '2026-05' });
    const r = setFechamentoDia(s, '10', TODAY);

    expect(r.fechamentoDia).toBe('10');
    expect(r.historico).toHaveLength(0);   // nada foi fechado
    expect(r.ultimoFechamento).toBe('2026-06');
    // e o rollover seguinte também fica quieto: o ciclo já está no dia certo
    expect(applyRollover(r, TODAY)).toBe(r);
  });

  it('subir o dia não anda com a âncora para trás (não refecha mês já fechado)', () => {
    const s = baseState({ fechamentoDia: '10', ultimoFechamento: '2026-06' });
    const r = setFechamentoDia(s, '20', TODAY);
    expect(r.ultimoFechamento).toBe('2026-06');
    expect(applyRollover(r, TODAY)).toBe(r);
  });

  it('dia incompleto/inválido só guarda o texto digitado', () => {
    const s = baseState({ ultimoFechamento: '2026-05' });
    expect(setFechamentoDia(s, '', TODAY)).toMatchObject({
      fechamentoDia: '',
      ultimoFechamento: '2026-05',
    });
  });

  it('primeiro dia informado não mexe na âncora (quem ancora é o rollover)', () => {
    const s = baseState({ fechamentoDia: '', ultimoFechamento: '' });
    expect(setFechamentoDia(s, '3', TODAY).ultimoFechamento).toBe('');
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

  it('desmarca as despesas fixas pagas no fechamento', () => {
    const s = baseState({
      despesas: [
        { nome: 'Aluguel', valor: '200,00', venc: '10', pago: '2026-06' },
        { nome: 'Luz', valor: '80,00', venc: '5' },
      ],
    });
    const r = manualClose(s, TODAY);
    expect(r.despesas[0].pago).toBe('');
    expect(r.despesas[1].pago).toBeUndefined();
    // preserva os demais campos e não muta o estado original
    expect(r.despesas[0].valor).toBe('200,00');
    expect(s.despesas[0].pago).toBe('2026-06');
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

  it('guarda o detalhamento do mês (itens e totais por grupo)', () => {
    const s = baseState({
      cartao: [{ nome: 'Mercado', valor: '30,00', cat: 'alimentacao' }, { nome: '', valor: '' }],
    });
    const h = manualClose(s, TODAY).historico[0];

    expect(h.totais.fixas).toBeCloseTo(200, 2);
    expect(h.totais.assinaturas).toBeCloseTo(50, 2);
    expect(h.totais.comprasCartao).toBeCloseTo(30, 2);
    // linhas vazias não entram no detalhamento
    expect(h.detalhes.cartao).toEqual([{ nome: 'Mercado', valor: 30, cat: 'alimentacao' }]);
    expect(h.detalhes.despesas).toEqual([{ nome: 'Aluguel', valor: 200 }]);
    // parcelamento ativo entra com a parcela do mês
    expect(h.detalhes.parcelas[0]).toMatchObject({ nome: 'Notebook', parcela: '1/12' });
    expect(h.detalhes.parcelas[0].valor).toBeCloseTo(10, 2);
  });
});

describe('resumoMes', () => {
  const registro = () =>
    manualClose(
      baseState({
        cartao: [{ nome: 'Mercado', valor: '30,00', cat: 'alimentacao' }],
        rendaExtra: [{ nome: 'Freela', valor: '300,00' }],
      }),
      TODAY,
    ).historico[0];

  it('resume ganhos, gastos e guardado de um mês fechado', () => {
    const r = resumoMes(registro());
    expect(r.ganhos).toBeCloseTo(1300, 2); // salário + renda extra
    expect(r.gasto).toBeCloseTo(290, 2);
    expect(r.temDetalhes).toBe(true);
    expect(r.rendaExtraItens).toEqual([{ nome: 'Freela', valor: 300 }]);
  });

  it('resolve a etiqueta da compra pela categoria', () => {
    const r = resumoMes(registro(), [{ id: 'alimentacao', label: 'Alimentação', color: '#e0564c' }]);
    const cartao = r.grupos.find((g) => g.id === 'cartao');
    expect(cartao.itens[0].catLabel).toBe('Alimentação');
    expect(cartao.total).toBeCloseTo(30, 2);
  });

  it('separa crédito e débito em grupos próprios, cada um com sua etiqueta', () => {
    const h = manualClose(
      baseState({
        cartao: [{ nome: 'Mercado', valor: '30,00', cat: 'alimentacao' }],
        debito: [{ nome: 'Farmácia', valor: '60,00', cat: 'saude' }],
      }),
      TODAY,
    ).historico[0];
    const r = resumoMes(h, [
      { id: 'alimentacao', label: 'Alimentação', color: '#e0564c' },
      { id: 'saude', label: 'Saúde', color: '#0e9f6e' },
    ]);

    const debito = r.grupos.find((g) => g.id === 'debito');
    expect(debito.total).toBeCloseTo(60, 2);
    expect(debito.itens[0].catLabel).toBe('Saúde');
    expect(r.grupos.find((g) => g.id === 'cartao').total).toBeCloseTo(30, 2);
    expect(r.gasto).toBeCloseTo(350, 2); // 290 + 60 do débito
  });

  it('mês sem gasto no débito não cria o grupo vazio', () => {
    expect(resumoMes(registro()).grupos.some((g) => g.id === 'debito')).toBe(false);
  });

  it('mês antigo (só totais) vira resumo sem detalhes', () => {
    const r = resumoMes({ periodo: '2025-01', salario: 1000, gasto: 400, guardado: 600 });
    expect(r.temDetalhes).toBe(false);
    expect(r.grupos).toEqual([]);
    expect(r.guardado).toBe(600);
  });
});
