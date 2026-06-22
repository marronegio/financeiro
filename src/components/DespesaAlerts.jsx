import React, { useState } from 'react';
import { computeDespesaAlerts } from '../despesaAlerts.js';

// Texto do "vence em ..." conforme os dias restantes.
function quando(daysUntil) {
  if (daysUntil <= 0) return 'vence hoje';
  if (daysUntil === 1) return 'vence amanhã';
  return `vence em ${daysUntil} dias`;
}

// Pilha de avisos (estilo push) para os vencimentos das despesas fixas.
// "Ignorar" some até a próxima sessão; "Já paguei" suprime até o próximo mês.
export default function DespesaAlerts({ despesas, onPaid }) {
  const [dismissed, setDismissed] = useState(() => new Set());

  const alerts = computeDespesaAlerts(despesas).filter((a) => !dismissed.has(a.key));
  if (alerts.length === 0) return null;

  const ignorar = (key) => setDismissed((prev) => new Set(prev).add(key));

  return (
    <div className="toast-stack" role="region" aria-label="Avisos de vencimento">
      {alerts.map((a) => (
        <div key={a.key} className={'toast' + (a.daysUntil <= 0 ? ' toast-urgent' : '')}>
          <span className="toast-ico" aria-hidden="true">🔔</span>
          <div className="toast-body">
            <p className="toast-text">
              A despesa fixa <strong>“{a.nome}”</strong> {quando(a.daysUntil)}.
            </p>
            <div className="toast-actions">
              <button className="toast-btn ghost" onClick={() => ignorar(a.key)}>
                Ignorar
              </button>
              <button className="toast-btn primary" onClick={() => onPaid(a.idx, a.duePeriod)}>
                Já paguei
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
