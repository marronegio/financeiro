import React, { Suspense, lazy, useState } from 'react';
import { BRL, onlyDigits, toNumber } from '../money.js';
import { fmtPeriodo, computeInsights } from '../history.js';
import MoneyField from './MoneyField.jsx';

// Carrega o gráfico (e todo o MUI Charts) só quando a aba Histórico é aberta.
const HistoryChart = lazy(() => import('./HistoryChart.jsx'));

function DayField({ label, value, onChange }) {
  const handle = (raw) => {
    const d = onlyDigits(raw).slice(0, 2);
    if (d === '') return onChange('');
    const n = parseInt(d, 10);
    if (n >= 1 && n <= 31) onChange(String(n));
  };
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="money-input">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => handle(e.target.value)}
          placeholder="1–31"
          autoComplete="off"
        />
        <span className="suffix">do mês</span>
      </div>
    </label>
  );
}

export default function HistoricoPanel({ state, setField, onClose }) {
  const [confirmando, setConfirmando] = useState(false);
  const [guardadoInput, setGuardadoInput] = useState('');

  const historico = [...(state.historico || [])].reverse();
  const insights = computeInsights(state.historico);

  function handleConfirmar() {
    onClose(toNumber(guardadoInput));
    setConfirmando(false);
    setGuardadoInput('');
  }

  return (
    <div className="panel">
      <div className="card">
        <div className="card-head">
          <span className="card-title">Ciclo do mês</span>
        </div>

        <div className="day-grid">
          <DayField
            label="Dia do recebimento"
            value={state.recebimentoDia || ''}
            onChange={(v) => setField('recebimentoDia', v)}
          />
          <DayField
            label="Dia do pagamento da fatura"
            value={state.faturaDia || ''}
            onChange={(v) => setField('faturaDia', v)}
          />
        </div>

        <p className="hint">
          Todo mês, no <b>dia do recebimento</b>, os gastos avulsos do cartão são zerados, cada
          parcelamento avança uma parcela e um resumo do mês é guardado abaixo.
        </p>

        {!confirmando ? (
          <button className="add-btn" style={{ marginTop: 12 }} onClick={() => setConfirmando(true)}>
            ↦ Fechar mês agora
          </button>
        ) : (
          <div className="close-confirm">
            <MoneyField
              label="Quanto você conseguiu guardar este mês?"
              value={guardadoInput}
              onChange={setGuardadoInput}
            />
            <div className="close-actions">
              <button className="btn-confirm" onClick={handleConfirmar}>
                Confirmar fechamento
              </button>
              <button
                className="btn-cancel"
                onClick={() => { setConfirmando(false); setGuardadoInput(''); }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {insights.length > 0 && (
        <div className="card">
          <div className="card-head">
            <span className="card-title">Insights</span>
          </div>
          {insights.map((ins, i) => (
            <div className={'insight-row ' + ins.tone} key={i}>
              <span className="insight-ico">
                {ins.tone === 'pos' ? '▲' : ins.tone === 'neg' ? '▼' : '•'}
              </span>
              <span className="insight-text">{ins.text}</span>
            </div>
          ))}
        </div>
      )}

      <Suspense
        fallback={
          <div className="card">
            <div className="card-head">
              <span className="card-title">Evolução</span>
            </div>
            <p className="hint hist-empty">Carregando gráfico…</p>
          </div>
        }
      >
        <HistoryChart historico={state.historico} />
      </Suspense>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Resumo mensal</span>
          <span className="card-total">
            {historico.length} {historico.length === 1 ? 'mês' : 'meses'}
          </span>
        </div>

        {historico.length === 0 ? (
          <p className="hint hist-empty">
            Ainda não há meses fechados. Quando chegar o dia do recebimento — ou ao usar “Fechar mês
            agora” — o resumo aparece aqui.
          </p>
        ) : (
          historico.map((h, i) => (
            <div className="hist-row" key={(h.periodo || '') + '-' + i}>
              <div className="hist-per">{fmtPeriodo(h.periodo)}</div>
              <div className="hist-nums">
                <span className="hist-num gasto">
                  <span className="hist-lbl">Gasto</span>
                  {BRL(h.gasto)}
                </span>
                <span
                  className="hist-num"
                  style={{ color: h.guardado >= 0 ? 'var(--positive)' : 'var(--negative)' }}
                >
                  <span className="hist-lbl">Guardado</span>
                  {BRL(h.guardado)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
