import { compute, computeParcela } from './money.js';

// ---- chaves de período no formato 'YYYY-MM' (comparáveis como string) ----
const periodKey = (y, m0) => `${y}-${String(m0 + 1).padStart(2, '0')}`;

function nextPeriod(key) {
  const [y, m] = key.split('-').map(Number); // m é 1-based
  const d = new Date(y, m, 1); // Date usa mês 0-based → m aponta o mês seguinte
  return periodKey(d.getFullYear(), d.getMonth());
}

// Período "devido" mais recente dado o dia de fechamento do ciclo. 
function latestDuePeriod(today, dia) {
  const y = today.getFullYear();
  const m = today.getMonth();
  if (today.getDate() >= dia) return periodKey(y, m);
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

// Aplica um fechamento: salva o resumo do mês, zera os gastos avulsos do cartão
// e avança cada parcelamento ativo em uma parcela. Muta o array `historico` recebido.
function performClose(state, periodo, historico) {
  const c = compute(state);
  historico.push({
    periodo,
    salario: c.salario,
    gasto: c.gastos,
    cartao: c.faturaCartao, // gasto no cartão (compras + parcelas do mês)
    guardado: c.sobra, // "quanto foi guardado" = sobra real do mês
    meta: c.guardar, // meta de economia, como referência
  });

  const cartao = [{ nome: '', valor: '' }];
  const parcelamentos = state.parcelamentos.map((it) => {
    const p = computeParcela(it);
    if (!(p.parc > 0) || p.done) return it;
    return { ...it, pagas: String(Math.min(p.parc, p.pagas + 1)) };
  });

  return { ...state, cartao, parcelamentos };
}

// Roda no carregamento: fecha automaticamente os meses pendentes desde o último
// fechamento até o período devido. Retorna o MESMO objeto quando não há nada a fazer
// (assim o setState do React não dispara re-render/gravação à toa).
export function applyRollover(state, today = new Date()) {
  const dia = parseInt(state.recebimentoDia, 10);
  if (!dia || dia < 1 || dia > 31) return state;

  const due = latestDuePeriod(today, dia);

  // Primeira vez com o dia definido: apenas ancora, sem fechar nada agora.
  if (!state.ultimoFechamento) {
    return { ...state, ultimoFechamento: due };
  }
  if (state.ultimoFechamento >= due) return state;

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

// Fechamento manual (botão "Fechar mês agora"), independente da data.
export function manualClose(state, today = new Date()) {
  const periodo = periodKey(today.getFullYear(), today.getMonth());
  const historico = [...(state.historico || [])];
  const next = performClose(state, periodo, historico);
  const ultimo =
    state.ultimoFechamento && state.ultimoFechamento > periodo ? state.ultimoFechamento : periodo;
  return { ...next, historico, ultimoFechamento: ultimo };
}
