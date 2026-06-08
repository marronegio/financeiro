import React from 'react';
import { BRL } from '../money.js';
import MoneyField from './MoneyField.jsx';

export default function PlanejamentoPanel({ state, c, setField, reset }) {
  // Base para as larguras da barra de composição (sempre relativa ao salário).
  const base = c.salario > 0 ? c.salario : c.gastos + c.guardar + Math.max(0, c.sobra) || 1;
  const pct = (v) => Math.max(0, Math.min(100, (v / base) * 100));
  const positive = c.sobra >= 0;

  return (
    <div className="panel">
      <div className="grid">
        <div>
          <div className="card">
            <div className="card-head">
              <span className="card-title">Renda &amp; Meta</span>
            </div>
            <MoneyField
              label="Salário mensal"
              value={state.salario}
              onChange={(v) => setField('salario', v)}
            />
            <MoneyField
              label="Quero guardar por mês"
              value={state.guardar}
              onChange={(v) => setField('guardar', v)}
            />
          </div>

          <div className="card">
            <div className="card-head">
              <span className="card-title">Divisão do que sobra</span>
            </div>
            <div className="split-head">
              <span className="split-pill c">Crédito {c.pctC}%</span>
              <span className="split-pill d">{c.pctD}% Débito</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={state.split}
              style={{ '--p': c.pctC + '%' }}
              onChange={(e) => setField('split', parseInt(e.target.value, 10))}
            />
          </div>
        </div>

        <div className="sticky">
          <div className="card">
            <div className="card-head">
              <span className="card-title">Resultado do mês</span>
            </div>

            <div className={'hero ' + (positive ? 'pos' : 'neg')}>
              <div className="lo-label">Sobra disponível</div>
              <div className="lo-value">{BRL(c.sobra)}</div>
              <div className="lo-note">
                {positive
                  ? 'depois de gastos e do que você guarda'
                  : 'você está no vermelho neste mês'}
              </div>
            </div>

            <div className="legend">
              <div className="item">
                <span className="dot" style={{ background: 'var(--expense)' }} />
                Gastos
              </div>
              <div className="item">
                <span className="dot" style={{ background: 'var(--savings)' }} />
                Guardado
              </div>
              <div className="item">
                <span className="dot" style={{ background: 'var(--credit)' }} />
                Crédito
              </div>
              <div className="item">
                <span className="dot" style={{ background: 'var(--debit)' }} />
                Débito
              </div>
            </div>

            <div className="bar">
              <span style={{ background: 'var(--expense)', width: pct(c.gastos) + '%' }} />
              <span style={{ background: 'var(--savings)', width: pct(c.guardar) + '%' }} />
              <span style={{ background: 'var(--credit)', width: pct(c.credito) + '%' }} />
              <span style={{ background: 'var(--debit)', width: pct(c.debito) + '%' }} />
            </div>

            <div>
              <div className="summary-line">
                <span className="lbl">
                  <span className="dot" style={{ background: 'var(--ink)' }} />
                  Salário
                </span>
                <span className="amt">{BRL(c.salario)}</span>
              </div>
              <div className="summary-line minus">
                <span className="lbl">
                  <span className="dot" style={{ background: 'var(--expense)' }} />
                  Total de gastos
                </span>
                <span className="amt">{BRL(c.gastos)}</span>
              </div>
              <div className="summary-line minus">
                <span className="lbl">
                  <span className="dot" style={{ background: 'var(--savings)' }} />
                  Guardado
                </span>
                <span className="amt">{BRL(c.guardar)}</span>
              </div>
              <div className="summary-line total">
                <span className="lbl">
                  <strong>Sobra</strong>
                </span>
                <span
                  className="amt"
                  style={{ color: positive ? 'var(--positive)' : 'var(--negative)' }}
                >
                  {BRL(c.sobra)}
                </span>
              </div>
            </div>

            <div className="split-cards">
              <div className="split-card credit">
                <div className="sc-tag">
                  <span>Crédito</span>
                  <span className="sc-pct">{c.pctC}%</span>
                </div>
                <div className="sc-value">{BRL(c.credito)}</div>
                <div className="sc-desc">limite pra gastar na fatura</div>
              </div>
              <div className="split-card debit">
                <div className="sc-tag">
                  <span>Débito</span>
                  <span className="sc-pct">{c.pctD}%</span>
                </div>
                <div className="sc-value">{BRL(c.debito)}</div>
                <div className="sc-desc">disponível na conta</div>
              </div>
            </div>

            {c.sobra < 0 && c.salario > 0 && (
              <div className="warn show">
                <span>⚠</span>
                <span>
                  Seus gastos e a meta de economia já passam do salário. Reduza algo ou diminua o
                  quanto quer guardar.
                </span>
              </div>
            )}

            <button className="reset" onClick={reset}>
              ↺ Limpar tudo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
