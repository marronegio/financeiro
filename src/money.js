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

// Cálculo agregado de todo o estado (fonte única da verdade dos números do dashboard).
export function compute(state) {
  const salario = toNumber(state.salario);
  const guardar = toNumber(state.guardar);
  const totDesp = state.despesas.reduce((s, it) => s + toNumber(it.valor), 0);
  const totAss = state.assinaturas.reduce((s, it) => s + toNumber(it.valor), 0);
  const totCartao = state.cartao.reduce((s, it) => s + toNumber(it.valor), 0);
  const totAbates = (state.abates || []).reduce((s, it) => s + toNumber(it.valor), 0);
  const totRendaExtra = (state.rendaExtra || []).reduce((s, it) => s + toNumber(it.valor), 0);
  // O usuário pode optar por não somar a renda extra no planejamento (padrão: soma).
  const somarRendaExtra = state.somarRendaExtra !== false;
  const rendaExtraNoPlano = somarRendaExtra ? totRendaExtra : 0;

  let parcelaMensal = 0;
  let parcelaRestante = 0;
  let parcelaAtivas = 0;
  let parcelaUltimasCount = 0;
  let parcelaUltimasValor = 0;
  state.parcelamentos.forEach((it) => {
    const p = computeParcela(it);
    if (p.parc > 0 && !p.done) {
      parcelaMensal += p.mensal;
      parcelaAtivas += 1;
      // Parcelamentos com apenas uma parcela restante — estão acabando este mês.
      if (p.restantes === 1) {
        parcelaUltimasCount += 1;
        parcelaUltimasValor += p.mensal;
      }
    }
    parcelaRestante += p.falta;
  });

  // A fatura inclui compras, assinaturas e a parcela do mês; os abates reduzem.
  const faturaCartao = totCartao + totAss + parcelaMensal - totAbates;
  // Gastos somam tudo (menos os abates, que diminuem o desembolso real).
  const gastos = totDesp + totAss + totCartao + parcelaMensal - totAbates;
  // A renda extra do mês soma à renda disponível (quando o usuário opta por somá-la).
  const sobra = salario + rendaExtraNoPlano - gastos - guardar;
  const pctC = state.split;
  const pctD = 100 - state.split;
  const credito = (Math.max(0, sobra) * pctC) / 100;
  const debito = (Math.max(0, sobra) * pctD) / 100;

  return {
    salario, guardar, totDesp, totAss, totCartao, totAbates,
    totRendaExtra, somarRendaExtra, rendaExtraNoPlano,
    parcelaMensal, parcelaRestante, parcelaAtivas,
    parcelaUltimasCount, parcelaUltimasValor, faturaCartao,
    gastos, sobra, pctC, pctD, credito, debito,
  };
}
