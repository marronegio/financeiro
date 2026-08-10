export const BRL = (n) =>
  (isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// "1234" -> "12,34" (máscara enquanto digita).
export function maskMoney(v) {
  const d = String(v).replace(/\D/g, '');
  if (!d) return '';
  return (parseInt(d, 10) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// "R$ 12,34" / "12,34" -> 12.34
export function toNumber(v) {
  const d = String(v).replace(/\D/g, '');
  return d ? parseInt(d, 10) / 100 : 0;
}

export const onlyDigits = (v) => String(v).replace(/\D/g, '');

// Cálculos de um parcelamento individual.
export function computeParcela(it) {
  const total = toNumber(it.total);
  const parc = parseInt(it.parcelas, 10) || 0;
  const pagas = Math.min(Math.max(0, parseInt(it.pagas, 10) || 0), parc);
  const mensal = parc > 0 ? total / parc : 0;
  const restantes = Math.max(0, parc - pagas);
  const falta = mensal * restantes;
  const pct = parc > 0 ? Math.round((pagas / parc) * 100) : 0;
  const done = parc > 0 && pagas >= parc;
  return { total, parc, pagas, mensal, restantes, falta, pct, done };
}

// Sobra realizada de um mês FECHADO, a partir do resumo salvo no histórico.
//
// Cuidado com o campo `guardado`: ele NÃO é a sobra. É quanto a pessoa separou
// no mês — no fechamento manual ela informa esse valor, e ele costuma ser bem
// menor que o que ficou livre (guardar 100 num mês em que sobraram 329 é o caso
// normal, não a exceção). Ler `guardado` como se fosse a sobra faz o app tratar
// a poupança da pessoa como o dinheiro que ela tinha para gastar.
//
// Esta é a definição usada no gráfico do Histórico (a linha "Sobrou") e no
// orçamento do débito. Uma definição só: se as duas telas discordarem sobre
// quanto sobrou num mês, uma delas está mentindo.
export function sobraDoMes(h) {
  return (
    (Number(h?.salario) || 0) +
    (Number(h?.rendaExtra) || 0) -
    (Number(h?.gasto) || 0) -
    (Number(h?.guardado) || 0)
  );
}

// Cálculo agregado de todo o estado (fonte única da verdade dos números do dashboard).
export function compute(state) {
  const salario = toNumber(state.salario);
  const guardar = toNumber(state.guardar);
  const totDesp = state.despesas.reduce((s, it) => s + toNumber(it.valor), 0);
  const totAss = state.assinaturas.reduce((s, it) => s + toNumber(it.valor), 0);
  const totDoacoes = (state.doacoes || []).reduce((s, it) => s + toNumber(it.valor), 0);
  const totCartao = state.cartao.reduce((s, it) => s + toNumber(it.valor), 0);
  // Compras pagas na hora (débito, Pix, dinheiro). Saem da conta do mês como
  // qualquer gasto, mas NÃO passam pelo cartão: ficam fora da fatura e não
  // reservam limite de crédito.
  const totDebito = (state.debito || []).reduce((s, it) => s + toNumber(it.valor), 0);
  const totAbates = (state.abates || []).reduce((s, it) => s + toNumber(it.valor), 0);
  const totRendaExtra = (state.rendaExtra || []).reduce((s, it) => s + toNumber(it.valor), 0);
  // O usuário pode optar por não somar a renda extra no planejamento (padrão: soma).
  const somarRendaExtra = state.somarRendaExtra !== false;
  const rendaExtraNoPlano = somarRendaExtra ? totRendaExtra : 0;

  let parcelaMensal = 0;
  // Parcelas pagas via Pix (ex.: reembolso a alguém que parcelou por você) não
  // passam pela fatura do cartão, mas continuam sendo gasto do mês.
  let parcelaMensalCartao = 0;
  let parcelaMensalPix = 0;
  let parcelaRestante = 0;
  // Saldo devedor total das parcelas que passam pelo cartão (todas as parcelas
  // ainda não pagas, não só a do mês). É o que continua reservado no limite.
  let parcelaRestanteCartao = 0;
  let parcelaAtivas = 0;
  let parcelaUltimasCount = 0;
  let parcelaUltimasValor = 0;
  state.parcelamentos.forEach((it) => {
    const p = computeParcela(it);
    if (p.parc > 0 && !p.done) {
      parcelaMensal += p.mensal;
      if (it.pix) parcelaMensalPix += p.mensal;
      else {
        parcelaMensalCartao += p.mensal;
        parcelaRestanteCartao += p.falta;
      }
      parcelaAtivas += 1;
      // Parcelamentos com apenas uma parcela restante — estão acabando este mês.
      if (p.restantes === 1) {
        parcelaUltimasCount += 1;
        parcelaUltimasValor += p.mensal;
      }
    }
    parcelaRestante += p.falta;
  });

  // A fatura inclui compras, assinaturas e só as parcelas do cartão (as via Pix
  // ficam fora); os abates reduzem.
  const faturaCartao = totCartao + totAss + parcelaMensalCartao - totAbates;
  // Gastos somam tudo (menos os abates, que diminuem o desembolso real).
  const gastos = totDesp + totAss + totDoacoes + totCartao + totDebito + parcelaMensal - totAbates;
  // A renda extra do mês soma à renda disponível (quando o usuário opta por somá-la).
  const sobra = salario + rendaExtraNoPlano - gastos - guardar;

  // ── Orçamento do débito ────────────────────────────────────────────
  // É a sobra do último mês FECHADO, e nada mais. Esse é o único número que
  // representa dinheiro que a pessoa realmente teve na mão: quem fechou o mês
  // com 300 tem 300 para gastar, não uma fatia de uma projeção do mês corrente
  // (que sobe e desce a cada lançamento e chega a prometer milhares que nunca
  // existiram).
  //
  // A sobra sai de `sobraDoMes` (acima) — e NÃO do campo `guardado`, que é o
  // que a pessoa separou, não o que ficou livre. Mês fechado no vermelho não
  // vira orçamento negativo: vira zero.
  const fechados = state.historico || [];
  const ultimoFechado = fechados.length ? fechados[fechados.length - 1] : null;
  const temOrcamentoDebito = !!ultimoFechado;
  const orcamentoDebito = Math.max(0, sobraDoMes(ultimoFechado));
  const orcamentoDebitoPeriodo = ultimoFechado?.periodo || '';

  // Quanto ainda cabe no débito. São DOIS limites, e vale o menor:
  //  - o orçamento (a sobra do mês passado), menos o que já foi gasto nele;
  //  - a sobra do mês corrente, que é o dinheiro que de fato ainda existe.
  // Sem o segundo, um mês corrente mais apertado que o anterior autorizaria a
  // gastar dinheiro que já acabou.
  const debitoOrcamentoRestante = orcamentoDebito - totDebito;
  const debitoDisponivel = Math.min(debitoOrcamentoRestante, sobra);
  // Verdadeiro quando quem está segurando é a sobra do mês corrente, e não o
  // orçamento — o painel precisa dizer isso, senão o número parece errado.
  const debitoNoTeto = sobra < debitoOrcamentoRestante;

  // Limite do cartão: o que já está comprometido (compras + assinaturas +
  // saldo devedor das parcelas do cartão, menos abates) reserva o limite; o
  // resto fica disponível. Só faz sentido quando o usuário informou o limite.
  const limiteCartao = toNumber(state.limiteCartao);
  const limiteUsado = totCartao + totAss + parcelaRestanteCartao - totAbates;
  const limiteDisponivel = limiteCartao - limiteUsado;

  return {
    salario, guardar, totDesp, totAss, totDoacoes, totCartao, totDebito, totAbates,
    totRendaExtra, somarRendaExtra, rendaExtraNoPlano,
    parcelaMensal, parcelaMensalCartao, parcelaMensalPix, parcelaRestante,
    parcelaRestanteCartao, parcelaAtivas,
    parcelaUltimasCount, parcelaUltimasValor, faturaCartao,
    limiteCartao, limiteUsado, limiteDisponivel,
    gastos, sobra,
    temOrcamentoDebito, orcamentoDebito, orcamentoDebitoPeriodo,
    debitoOrcamentoRestante, debitoDisponivel, debitoNoTeto,
  };
}
