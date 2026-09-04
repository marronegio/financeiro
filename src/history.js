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
    // As linhas cruas dos parcelamentos, como estavam ANTES de o fechamento
    // avançar a parcela. `parcelas` acima é a vitrine do mês (o "3/12" que o
    // resumo mostra); estas são o que permite recriar do zero um parcelamento
    // apagado depois de um fechamento errado.
    parcelamentos: (state.parcelamentos || [])
      .filter((it) => String(it.nome || '').trim() || toNumber(it.total) > 0)
      .map((it) => ({ ...it })),
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

// ── Desfazer o último fechamento ────────────────────────────────────────
// Fechou o mês sem querer? Este é o botão de voltar atrás, e ele devolve o mês
// INTEIRO: o resumo sai do histórico e todo lançamento que estava no perfil na
// hora do fechamento volta para o perfil — as compras do cartão e do débito, a
// renda extra, as doações, os abates, as despesas fixas, as assinaturas e os
// parcelamentos — a partir da fotografia guardada no próprio resumo.
//
// Não volta só o que o fechamento zerou: volta também o que a pessoa apagou
// DEPOIS do fechamento errado. Quem fecha o mês por engano costuma mexer na tela
// antes de achar o botão de desfazer, e um "desfazer" que devolve metade do mês
// obriga a redigitar a outra metade de memória.
//
// O que ela lançou ou editou depois continua como ela deixou: nada é sobrescrito
// e nada é duplicado — o desfazer soma o mês de volta, não joga um retrato por
// cima do que existe hoje.
//
// O `ultimoFechamento` NÃO volta atrás de propósito: o marcador é o que impede o
// rollover de fechar de novo: devolvê-lo faria o app refechar o mesmo mês no
// próximo carregamento, e a pessoa perderia os dados outra vez.

// Número (30) → o texto com máscara que os campos do app usam ('30,00').
const paraCampo = (v) => maskMoney(String(Math.round((Number(v) || 0) * 100)));

const nomeChave = (n) => String(n || '').trim().toLowerCase();
const itemChave = (nome, valor) => `${nomeChave(nome)}|${(Number(valor) || 0).toFixed(2)}`;

// Item da fotografia → linha do app (o valor numérico vira campo com máscara).
const paraLinha = (it, vazio) => {
  const { valor, ...resto } = it;
  return { ...vazio, ...resto, valor: paraCampo(valor) };
};

// O que fica quando a lista termina sem nada. `vazio` nulo = lista que vive
// vazia mesmo (os abates), sem a linha em branco de digitação no fim.
const listaOu = (lista, vazio) => (lista.length ? lista : vazio ? [{ ...vazio }] : []);

// Lançamentos avulsos do mês (compras, renda extra, doações pontuais, abates):
// a mesma compra pode aparecer duas vezes no mês, então a comparação é por
// MULTICONJUNTO — conta quantas cópias de cada nome+valor já estão na lista e
// repõe só as que faltam. Comparar por presença engolia a repetida: dois Uber de
// 20,00 no mesmo mês voltavam como um só.
function repor(atual, doSnapshot, vazio) {
  const atuais = (atual || []).filter((it) => toNumber(it.valor) > 0);
  const restam = new Map();
  for (const it of atuais) {
    const k = itemChave(it.nome, toNumber(it.valor));
    restam.set(k, (restam.get(k) || 0) + 1);
  }

  const voltando = [];
  for (const it of doSnapshot || []) {
    const k = itemChave(it.nome, it.valor);
    const n = restam.get(k) || 0;
    // Já está na lista (sobreviveu ao fechamento ou foi redigitado): não duplica.
    if (n > 0) {
      restam.set(k, n - 1);
      continue;
    }
    voltando.push(paraLinha(it, vazio));
  }

  return listaOu([...voltando, ...atuais], vazio);
}

// Listas que se repetem todo mês (despesas fixas, assinaturas, doações
// recorrentes): a linha é a mesma sempre e o NOME é a identidade dela — comparar
// por nome+valor faria uma conta de luz reajustada depois do fechamento voltar
// como uma segunda "Luz". Quem continua na lista fica como o usuário deixou; só
// os campos que o fechamento mexeu voltam (o "pago" das fixas). Quem sumiu
// depois do fechamento errado volta inteiro.
function reporRecorrentes(atual, doSnapshot, vazio, campos = []) {
  // Linha sem nome cai no valor: é tudo que a distingue de outra sem nome.
  const chaveAtual = (it) => nomeChave(it.nome) || `#${toNumber(it.valor).toFixed(2)}`;
  const chaveSnap = (it) => nomeChave(it.nome) || `#${(Number(it.valor) || 0).toFixed(2)}`;

  const porChave = new Map();
  for (const it of doSnapshot || []) {
    const k = chaveSnap(it);
    if (!porChave.has(k)) porChave.set(k, it);
  }

  const vistos = new Set();
  const mantidos = (atual || []).map((it) => {
    const k = chaveAtual(it);
    vistos.add(k);
    const snap = porChave.get(k);
    if (!snap) return it;
    let out = it;
    for (const campo of campos) if (snap[campo] && !out[campo]) out = { ...out, [campo]: snap[campo] };
    return out;
  });

  const voltando = [];
  for (const [k, it] of porChave) if (!vistos.has(k)) voltando.push(paraLinha(it, vazio));

  return listaOu([...voltando, ...mantidos], vazio);
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
  // era a do mês. Só recua quem continua exatamente onde o fechamento deixou —
  // se a pessoa mexeu no parcelamento depois, a edição dela manda.
  const doMes = new Map();
  for (const p of d.parcelas || []) doMes.set(nomeChave(p.nome), p);

  const vistosParc = new Set();
  const parcelamentosAtuais = (state.parcelamentos || []).map((it) => {
    const k = nomeChave(it.nome);
    vistosParc.add(k);
    const snap = doMes.get(k);
    if (!snap) return it;
    const eraPagas = parseInt(String(snap.parcela).split('/')[0], 10) - 1;
    const agora = parseInt(it.pagas, 10) || 0;
    if (!(eraPagas >= 0) || agora !== eraPagas + 1) return it;
    return { ...it, pagas: String(eraPagas) };
  });

  // Parcelamento apagado depois do fechamento errado volta como estava na hora
  // do fechamento — as linhas cruas da fotografia já guardam o `pagas` de antes
  // do avanço, então não há o que recuar aqui.
  const parcelamentosVoltando = (d.parcelamentos || [])
    .filter((it) => !vistosParc.has(nomeChave(it.nome)))
    .map((it) => ({ ...it }));

  const parcelamentos = listaOu([...parcelamentosVoltando, ...parcelamentosAtuais], {
    nome: '',
    total: '',
    parcelas: '',
    pagas: '',
  });

  // Doações: as recorrentes sobrevivem ao fechamento, então voltam pelo nome (só
  // as que a pessoa apagou depois); as avulsas, que o fechamento levou embora,
  // voltam pelo multiconjunto, como qualquer outro lançamento do mês.
  const vazioDoacao = { nome: '', valor: '', recorrente: false };
  const doacoesSnap = d.doacoes || [];
  const doacoes = repor(
    reporRecorrentes(state.doacoes, doacoesSnap.filter((x) => x.recorrente), vazioDoacao),
    doacoesSnap.filter((x) => !x.recorrente),
    vazioDoacao,
  );

  // As etiquetas que as compras do mês usavam: se alguma foi apagada depois do
  // fechamento, ela volta junto — senão a compra reaparece sem etiqueta nenhuma.
  const usadas = new Set(
    [...(d.cartao || []), ...(d.debito || [])].map((it) => it.cat).filter(Boolean),
  );
  const catsAtuais = state.cardCategories || [];
  const temCat = new Set(catsAtuais.map((c) => c.id));
  const catsFaltando = (d.categorias || []).filter((c) => usadas.has(c.id) && !temCat.has(c.id));

  return {
    ...state,
    historico,
    // O `pago` e só ele: é o único campo destas listas que o fechamento mexe.
    // Repor o `venc` junto desfaria uma data que a pessoa mudou depois.
    despesas: reporRecorrentes(state.despesas, d.despesas, { nome: '', valor: '', venc: '' }, [
      'pago',
    ]),
    assinaturas: reporRecorrentes(state.assinaturas, d.assinaturas, { nome: '', valor: '', venc: '' }),
    parcelamentos,
    doacoes,
    cartao: repor(state.cartao, d.cartao, { nome: '', valor: '', cat: '' }),
    debito: repor(state.debito, d.debito, { nome: '', valor: '', cat: '' }),
    rendaExtra: repor(state.rendaExtra, d.rendaExtra, { nome: '', valor: '' }),
    // Os abates não são zerados pelo fechamento, então só voltam os que a pessoa
    // apagou depois. A lista vive vazia mesmo — sem linha em branco no fim.
    abates: repor(state.abates, d.abates, null),
    ...(catsFaltando.length ? { cardCategories: [...catsAtuais, ...catsFaltando] } : {}),
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
