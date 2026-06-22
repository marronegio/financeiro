// Alertas de vencimento das despesas fixas.
//
// Cada despesa tem um dia de vencimento (`venc`, 1–31) que se repete todo mês.
// Disparamos um aviso quando faltam exatamente 3 dias, 1 dia ou 0 dia (vence hoje).
// O campo `pago` guarda o período ('YYYY-MM') da cobrança já quitada — enquanto
// ele bater com o vencimento atual, o aviso fica suprimido; no mês seguinte volta.

export const ALERT_DAYS = [3, 1, 0];

const MS_DIA = 86400000;

// 'YYYY-MM' a partir de um Date.
const periodKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// Meia-noite local (zera horas) — para contar dias inteiros sem ruído de horário.
const atMidnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Último dia do mês (mm é 0-based).
const lastDay = (y, m) => new Date(y, m + 1, 0).getDate();

// Próxima data de vencimento >= hoje, dado o dia `venc`. Dias além do fim do mês
// (ex.: 31 em fevereiro) caem no último dia do mês. Retorna null se venc inválido.
export function nextDueDate(venc, today = new Date()) {
  const v = parseInt(venc, 10);
  if (!v || v < 1 || v > 31) return null;

  const t = atMidnight(today);
  const y = t.getFullYear();
  const m = t.getMonth();

  const dayThis = Math.min(v, lastDay(y, m));
  if (t.getDate() <= dayThis) return new Date(y, m, dayThis);

  // O vencimento deste mês já passou → vai para o mês seguinte.
  const nm = new Date(y, m + 1, 1);
  const ny = nm.getFullYear();
  const nmo = nm.getMonth();
  return new Date(ny, nmo, Math.min(v, lastDay(ny, nmo)));
}

// Lista de alertas ativos para as despesas fixas. Cada alerta:
//   { key, idx, nome, daysUntil, duePeriod }
// `key` identifica a ocorrência (índice + período + dias) para o "Ignorar" da sessão.
export function computeDespesaAlerts(despesas, today = new Date()) {
  const out = [];
  (despesas || []).forEach((d, idx) => {
    const due = nextDueDate(d.venc, today);
    if (!due) return;

    const daysUntil = Math.round((due - atMidnight(today)) / MS_DIA);
    if (!ALERT_DAYS.includes(daysUntil)) return;

    const duePeriod = periodKey(due);
    if (d.pago === duePeriod) return; // já marcada como paga neste ciclo

    out.push({
      key: `${idx}|${duePeriod}|${daysUntil}`,
      idx,
      nome: (d.nome || '').trim() || 'sem nome',
      daysUntil,
      duePeriod,
    });
  });
  return out;
}
