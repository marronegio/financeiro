import { BRL, compute, computeParcela } from './money.js';

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

// Aplica um fechamento: salva o resumo do mês, zera os gastos avulsos do cartão
// e avança cada parcelamento ativo em uma parcela. Muta o array `historico` recebido.
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
  });

  const cartao = [{ nome: '', valor: '' }];
  // A renda extra é avulsa do mês — zera no fechamento, como o cartão.
  const rendaExtra = [{ nome: '', valor: '' }];
  const parcelamentos = state.parcelamentos.map((it) => {
    const p = computeParcela(it);
    if (!(p.parc > 0) || p.done) return it;
    return { ...it, pagas: String(Math.min(p.parc, p.pagas + 1)) };
  });

  return { ...state, cartao, rendaExtra, parcelamentos };
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
export function manualClose(state, today = new Date(), guardadoReal) {
  const periodo = periodKey(today.getFullYear(), today.getMonth());
  const historico = [...(state.historico || [])];
  const next = performClose(state, periodo, historico, guardadoReal);
  const ultimo =
    state.ultimoFechamento && state.ultimoFechamento > periodo ? state.ultimoFechamento : periodo;
  return { ...next, historico, ultimoFechamento: ultimo };
}
