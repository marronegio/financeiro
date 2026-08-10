import { BRL, compute, computeParcela, maskMoney, toNumber } from './money.js';

// ---- chaves de período no formato 'YYYY-MM' (comparáveis como string) ----
const periodKey = (y, m0) => `${y}-${String(m0 + 1).padStart(2, '0')}`;

function nextPeriod(key) {
  const [y, m] = key.split('-').map(Number); // m é 1-based
  const d = new Date(y, m, 1); // Date usa mês 0-based → m aponta o mês seguinte
  return periodKey(d.getFullYear(), d.getMonth());
}

// Último dia de um mês (m é 0-based). O dia 0 do mês seguinte é ele.
const ultimoDiaDoMes = (y, m) => new Date(y, m + 1, 0).getDate();

// O dia escolhido, ajustado ao mês: quem fecha no 31 fecha no dia 30 em abril e
// no 28/29 em fevereiro — o mês nunca deixa de fechar por falta de data.
export const diaDoMes = (dia, y, m) => Math.min(dia, ultimoDiaDoMes(y, m));

// Período "devido" mais recente dado o dia de fechamento do ciclo.
function latestDuePeriod(today, dia) {
  const y = today.getFullYear();
  const m = today.getMonth();
  if (today.getDate() >= diaDoMes(dia, y, m)) return periodKey(y, m);
  const prev = new Date(y, m - 1, 1);
  return periodKey(prev.getFullYear(), prev.getMonth());
}

// 'YYYY-MM' → 'jun/2026'
export function fmtPeriodo(p) {
  if (!p) return '—';
  const [y, m] = p.split('-').map(Number);
  return new Date(y, m - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    .replace('.', '');
}

// Soma de tudo que já foi guardado (acumulado, líquido) nos meses fechados.
export function totalGuardado(historico) {
  return (historico || []).reduce((s, h) => s + (Number(h.guardado) || 0), 0);
}

// Gera insights comparando o último mês fechado com o anterior. Retorna uma lista
// de { tone: 'pos'|'neg'|'neutral', text }.
export function computeInsights(historico) {
  const h = historico || [];
  if (h.length === 0) return [];

  const out = [];
  const last = h[h.length - 1];
  const total = totalGuardado(h);

  out.push({
    tone: total >= 0 ? 'pos' : 'neg',
    text: `Você já guardou ${BRL(total)} no total em ${h.length} ${h.length === 1 ? 'mês fechado' : 'meses fechados'}.`,
  });

  if (h.length >= 2) {
    const prev = h[h.length - 2];
    const ref = fmtPeriodo(prev.periodo);

    const dg = (Number(last.guardado) || 0) - (Number(prev.guardado) || 0);
    if (Math.abs(dg) >= 0.01) {
      out.push({
        tone: dg >= 0 ? 'pos' : 'neg',
        text: `Você guardou ${BRL(Math.abs(dg))} ${dg >= 0 ? 'a mais' : 'a menos'} que em ${ref}.`,
      });
    }

    if (prev.gasto > 0) {
      const pg = ((last.gasto - prev.gasto) / prev.gasto) * 100;
      if (Math.abs(pg) >= 1) {
        out.push({
          tone: pg <= 0 ? 'pos' : 'neg',
          text: `Seus gastos ${pg >= 0 ? 'subiram' : 'caíram'} ${Math.abs(Math.round(pg))}% em relação a ${ref}.`,
        });
      }
    }

    if (prev.cartao > 0 && last.cartao != null) {
      const pc = ((last.cartao - prev.cartao) / prev.cartao) * 100;
      if (Math.abs(pc) >= 1) {
        out.push({
          tone: pc <= 0 ? 'pos' : 'neg',
          text: `O gasto no cartão ${pc >= 0 ? 'aumentou' : 'diminuiu'} ${Math.abs(Math.round(pc))}%.`,
        });
      }
    }

    out.push({ tone: 'neutral', text: `Média guardada por mês: ${BRL(total / h.length)}.` });
  }

  return out;
}

// Itens de uma lista simples ({nome, valor}) já convertidos em número. Linhas
// sem valor (as vazias que o app sempre deixa no fim) ficam de fora. `extras`
// leva junto os campos próprios de cada lista (vencimento, pago, recorrente) —
// é o que permite devolver a lista intacta ao desfazer um fechamento.
const snapItems = (arr, extras = []) =>
  (arr || [])
    .map((it) => {
      const item = { nome: String(it.nome || '').trim(), valor: toNumber(it.valor) };
      if (it.cat) item.cat = it.cat;
      for (const k of extras) if (it[k]) item[k] = it[k];
      return item;
    })
    .filter((it) => it.valor > 0);

// Fotografia dos lançamentos do mês, guardada junto do resumo. É o que alimenta
// o popup de detalhes no Histórico e o PDF enviado por e-mail — sem isso, o mês
// fechado guardaria só os totais e a pessoa nunca saberia no que gastou.
function snapshotDetalhes(state) {
  const parcelas = (state.parcelamentos || [])
    .map((it) => {
      const p = computeParcela(it);
      if (!(p.parc > 0) || p.done) return null;
      return {
        nome: String(it.nome || '').trim(),
        valor: p.mensal,
        parcela: `${Math.min(p.parc, p.pagas + 1)}/${p.parc}`,
        pix: !!it.pix,
      };
    })
    .filter(Boolean);

  return {
    despesas: snapItems(state.despesas, ['venc', 'pago']),
    assinaturas: snapItems(state.assinaturas, ['venc']),
    doacoes: snapItems(state.doacoes, ['recorrente']),
    cartao: snapItems(state.cartao),
    debito: snapItems(state.debito),
    rendaExtra: snapItems(state.rendaExtra),
    abates: snapItems(state.abates),
    parcelas,
    // Etiquetas das compras no momento do fechamento: se a pessoa renomear ou
    // apagar uma categoria depois, o mês antigo continua legível.
    categorias: (state.cardCategories || []).map((c) => ({ id: c.id, label: c.label, color: c.color })),
  };
}

// Aplica um fechamento: salva o resumo do mês, zera os gastos avulsos (cartão e
// débito) e avança cada parcelamento ativo em uma parcela. Muta o array
// `historico` recebido.
function performClose(state, periodo, historico, guardadoReal) {
  const c = compute(state);
  historico.push({
    periodo,
    salario: c.salario,
    rendaExtra: c.totRendaExtra,
    gasto: c.gastos,
    cartao: c.faturaCartao,
    guardado: guardadoReal !== undefined ? guardadoReal : c.sobra,
    meta: c.guardar,
    // Totais por grupo + itens: o resumo detalhado do mês.
    totais: {
      fixas: c.totDesp,
      assinaturas: c.totAss,
      doacoes: c.totDoacoes,
      comprasCartao: c.totCartao,
      comprasDebito: c.totDebito,
      parcelas: c.parcelaMensal,
      abates: c.totAbates,
    },
    detalhes: snapshotDetalhes(state),
  });

  const cartao = [{ nome: '', valor: '' }];
  // As compras no débito são avulsas do mês, como as do cartão: zeram junto.
  const debito = [{ nome: '', valor: '', cat: '' }];
  // A renda extra é avulsa do mês — zera no fechamento, como o cartão.
  const rendaExtra = [{ nome: '', valor: '' }];
  // Desmarca o "pago" das despesas fixas: começam o novo mês como não pagas.
  const despesas = (state.despesas || []).map((d) => (d.pago ? { ...d, pago: '' } : d));
  const parcelamentos = state.parcelamentos.map((it) => {
    const p = computeParcela(it);
    if (!(p.parc > 0) || p.done) return it;
    return { ...it, pagas: String(Math.min(p.parc, p.pagas + 1)) };
  });
  // Doações avulsas somem no fechamento (como a renda extra); as recorrentes ficam,
  // então quem doa todo mês não precisa recadastrar.
  const doacoesRecorrentes = (state.doacoes || []).filter((d) => d.recorrente);
  const doacoes = doacoesRecorrentes.length ? doacoesRecorrentes : [{ nome: '', valor: '', recorrente: false }];

  return { ...state, cartao, debito, rendaExtra, despesas, parcelamentos, doacoes };
}

// ── Desfazer o último fechamento ───────────────────────────────────────────
// Devolve o mês fechado por engano: tira o resumo do histórico e repõe o que o
// fechamento zerou (compras do cartão e do débito, renda extra, doações avulsas)
// e o que ele avançou (as parcelas), tudo a partir da fotografia guardada no
// próprio resumo.
//
// O `ultimoFechamento` NÃO volta atrás de propósito: o marcador é o que impede o
// rollover de fechar de novo: devolvê-lo faria o app refechar o mesmo mês no
// próximo carregamento, e a pessoa perderia os dados outra vez.

// Número (30) → o texto com máscara que os campos do app usam ('30,00').
const paraCampo = (v) => maskMoney(String(Math.round((Number(v) || 0) * 100)));

// Junta a lista de hoje com a do fechamento, sem repetir o que já está lá
// (as doações recorrentes, por exemplo, sobrevivem ao fechamento).
function repor(atual, doSnapshot, vazio) {
  const atuais = (atual || []).filter((it) => toNumber(it.valor) > 0);
  const chave = (nome, valor) => `${String(nome || '').trim().toLowerCase()}|${valor.toFixed(2)}`;
  const vistos = new Set(atuais.map((it) => chave(it.nome, toNumber(it.valor))));

  const voltando = (doSnapshot || [])
    .filter((it) => !vistos.has(chave(it.nome, Number(it.valor) || 0)))
    .map(({ valor, ...resto }) => ({ ...vazio, ...resto, valor: paraCampo(valor) }));

  const lista = [...voltando, ...atuais];
  return lista.length ? lista : [{ ...vazio }];
}

export function undoLastClose(state) {
  const historico = [...(state.historico || [])];
  const ultimo = historico.pop();
  if (!ultimo) return state;

  const d = ultimo.detalhes;
  // Mês fechado antes de o app guardar a fotografia: dá para tirar o resumo
  // errado do histórico, mas os lançamentos daquele mês não existem mais.
  if (!d) return { ...state, historico };

  // Cada parcelamento ativo avançou uma parcela; a fotografia diz qual parcela
  // era a do mês. Só volta quem continua exatamente onde o fechamento deixou —
  // se a pessoa mexeu no parcelamento depois, a edição dela manda.
  const parcelamentos = (state.parcelamentos || []).map((it) => {
    const nome = String(it.nome || '').trim().toLowerCase();
    const snap = (d.parcelas || []).find((p) => String(p.nome || '').trim().toLowerCase() === nome);
    if (!snap) return it;
    const eraPagas = parseInt(String(snap.parcela).split('/')[0], 10) - 1;
    const agora = parseInt(it.pagas, 10) || 0;
    if (!(eraPagas >= 0) || agora !== eraPagas + 1) return it;
    return { ...it, pagas: String(eraPagas) };
  });

  // As fixas voltam a ficar marcadas como pagas onde estavam.
  const despesas = (state.despesas || []).map((dsp) => {
    const nome = String(dsp.nome || '').trim().toLowerCase();
    const snap = (d.despesas || []).find((x) => String(x.nome || '').trim().toLowerCase() === nome);
    return snap?.pago && !dsp.pago ? { ...dsp, pago: snap.pago } : dsp;
  });

  return {
    ...state,
    historico,
    despesas,
    parcelamentos,
    cartao: repor(state.cartao, d.cartao, { nome: '', valor: '', cat: '' }),
    debito: repor(state.debito, d.debito, { nome: '', valor: '', cat: '' }),
    rendaExtra: repor(state.rendaExtra, d.rendaExtra, { nome: '', valor: '' }),
    doacoes: repor(state.doacoes, d.doacoes, { nome: '', valor: '', recorrente: false }),
    // Os abates não são tocados pelo fechamento, então não há o que repor.
  };
}

// Troca do dia do fechamento. MUDAR A CONFIGURAÇÃO NUNCA FECHA UM MÊS: o
// período devido depende do dia, então baixar o dia (ex.: de 10 para 3, com hoje
// sendo 5) faria o applyRollover achar que o mês já venceu e fechar na hora, sem
// a pessoa pedir nada. Aqui o ciclo apenas re-ancora no período devido pelo novo
// dia — e só para frente: andar para trás faria um mês já fechado fechar de novo
// quando a data chegasse.
export function setFechamentoDia(state, valor, today = new Date()) {
  const next = { ...state, fechamentoDia: valor };
  const dia = parseInt(valor, 10);
  if (!dia || dia < 1 || dia > 31) return next;
  // Sem âncora ainda (primeiro dia informado): o applyRollover ancora sozinho,
  // também sem fechar nada.
  if (!state.ultimoFechamento) return next;

  const due = latestDuePeriod(today, dia);
  return due > state.ultimoFechamento ? { ...next, ultimoFechamento: due } : next;
}

// Roda no carregamento: fecha automaticamente os meses pendentes desde o último
// fechamento até o período devido. Retorna o MESMO objeto quando não há nada a fazer
// (assim o setState do React não dispara re-render/gravação à toa).
export function applyRollover(state, today = new Date()) {
  // Só o dia do fechamento manda no ciclo. Os dias de recebimento e de fatura
  // são informação da pessoa sobre o mês dela — mexer neles não fecha nada.
  const dia = parseInt(state.fechamentoDia, 10);
  if (!dia || dia < 1 || dia > 31) return state;

  const due = latestDuePeriod(today, dia);

  // Primeira vez com o dia definido: apenas ancora, sem fechar nada agora.
  if (!state.ultimoFechamento) {
    return { ...state, ultimoFechamento: due };
  }
  if (state.ultimoFechamento >= due) return state;

  // Fechamento automático desligado (o padrão): o mês só fecha pelo botão. Mesmo
  // assim o marcador anda junto com o calendário — senão, ao ligar a opção meses
  // depois, o app fecharia de uma vez todos os meses "atrasados" com os números
  // de hoje, inventando um histórico que nunca existiu.
  if (state.fechamentoAuto !== true) {
    return { ...state, ultimoFechamento: due };
  }

  let next = state;
  const historico = [...(state.historico || [])];
  let cursor = state.ultimoFechamento;
  let guard = 0;
  while (cursor < due && guard < 240) {
    cursor = nextPeriod(cursor);
    guard += 1;
    next = performClose(next, cursor, historico);
  }

  return { ...next, historico, ultimoFechamento: due };
}

// ── Resumo de um mês fechado (popup do Histórico e PDF) ────────────────────
const num = (v) => (isFinite(Number(v)) ? Number(v) : 0);
const somaItens = (arr) => (arr || []).reduce((s, it) => s + num(it.valor), 0);

// Normaliza um registro do histórico para a forma que a tela e o PDF usam.
// Meses fechados antes de o app guardar os detalhes só têm os totais — nesses,
// `temDetalhes` vem false e os grupos saem vazios (a tela avisa).
export function resumoMes(h, cats = []) {
  const d = h?.detalhes || null;
  const t = h?.totais || null;
  const temDetalhes = !!d;

  // Etiqueta da compra: a do fechamento primeiro (o nome que valia na época),
  // depois a lista atual do perfil, e por último o próprio id.
  const catMap = new Map();
  for (const c of cats || []) catMap.set(c.id, c);
  for (const c of d?.categorias || []) catMap.set(c.id, c);
  const catOf = (id) => (id ? catMap.get(id) || { id, label: id, color: '' } : null);

  const grupo = (id, label, itens, total) => ({
    id,
    label,
    itens: itens || [],
    total: total !== undefined && total !== null ? num(total) : somaItens(itens),
  });

  // Compras avulsas levam a etiqueta junto (crédito e débito usam a mesma lista).
  const comEtiqueta = (itens) =>
    (itens || []).map((it) => {
      const c = catOf(it.cat);
      return c ? { ...it, catLabel: c.label, catColor: c.color } : it;
    });

  const grupos = [
    grupo('fixas', 'Despesas fixas', d?.despesas, t?.fixas),
    grupo('assinaturas', 'Assinaturas', d?.assinaturas, t?.assinaturas),
    grupo('cartao', 'Crédito à vista', comEtiqueta(d?.cartao), t?.comprasCartao),
    grupo('debito', 'Débito', comEtiqueta(d?.debito), t?.comprasDebito),
    grupo(
      'parcelas',
      'Parcelas do mês',
      (d?.parcelas || []).map((p) => ({
        ...p,
        tag: [p.parcela, p.pix ? 'Pix' : ''].filter(Boolean).join(' · '),
      })),
      t?.parcelas,
    ),
    grupo('doacoes', 'Doações', d?.doacoes, t?.doacoes),
  ].filter((g) => g.total > 0 || g.itens.length > 0);

  const abates = grupo('abates', 'Abatimentos na fatura', d?.abates, t?.abates);
  const rendaExtraItens = d?.rendaExtra || [];

  const salario = num(h?.salario);
  const rendaExtra = num(h?.rendaExtra);

  return {
    periodo: h?.periodo || '',
    label: fmtPeriodo(h?.periodo),
    salario,
    rendaExtra,
    ganhos: salario + rendaExtra,
    gasto: num(h?.gasto),
    guardado: num(h?.guardado),
    meta: num(h?.meta),
    cartao: num(h?.cartao),
    grupos,
    abates: abates.total > 0 || abates.itens.length > 0 ? abates : null,
    rendaExtraItens,
    temDetalhes,
  };
}

// Fechamento manual (botão "Fechar mês agora"), independente da data.
export function manualClose(state, today = new Date(), guardadoReal) {
  const periodo = periodKey(today.getFullYear(), today.getMonth());
  const historico = [...(state.historico || [])];
  const next = performClose(state, periodo, historico, guardadoReal);
  const ultimo =
    state.ultimoFechamento && state.ultimoFechamento > periodo ? state.ultimoFechamento : periodo;
  return { ...next, historico, ultimoFechamento: ultimo };
}
