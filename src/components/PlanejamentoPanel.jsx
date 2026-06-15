import React, { useState } from 'react';
import { BRL, toNumber } from '../money.js';
import { totalGuardado } from '../history.js';
import MoneyField from './MoneyField.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';

export default function PlanejamentoPanel({ state, c, setField, reset }) {
  const [confirmReset, setConfirmReset] = useState(false);
  // Base para as larguras da barra de composição (sempre relativa ao salário).
  const base = c.salario > 0 ? c.salario : c.gastos + c.guardar + Math.max(0, c.sobra) || 1;
  const pct = (v) => Math.max(0, Math.min(100, (v / base) * 100));
  const positive = c.sobra >= 0;

  // Meta de economia (acumulado dos meses fechados vs. alvo total).
  const meta = toNumber(state.metaEconomia);
  const guardadoTotal = totalGuardado(state.historico);
  const metaPct = meta > 0 ? Math.max(0, Math.min(100, (guardadoTotal / meta) * 100)) : 0;
  const metaFalta = Math.max(0, meta - guardadoTotal);
  const metaEta = c.guardar > 0 && metaFalta > 0 ? Math.ceil(metaFalta / c.guardar) : 0;

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

          <div className="card">
            <div className="card-head">
              <span className="card-title">Meta de economia</span>
              {meta > 0 && <span className="card-total">{Math.round(metaPct)}%</span>}
            </div>
            <MoneyField
              label="Meta total (quanto quer juntar)"
              value={state.metaEconomia}
              onChange={(v) => setField('metaEconomia', v)}
            />
            {meta > 0 ? (
              <>
                <div className="usage-meta" style={{ marginTop: 12 }}>
                  <span>{BRL(guardadoTotal)} guardados</span>
                  <span>de {BRL(meta)}</span>
                </div>
                <div className="usage-bar">
                  <span style={{ width: metaPct + '%', background: 'var(--positive)' }} />
                </div>
                <p className="hint" style={{ borderTop: 'none', marginTop: 8, paddingTop: 0 }}>
                  {metaFalta > 0 ? (
                    <>
                      Faltam <b style={{ color: 'var(--positive)' }}>{BRL(metaFalta)}</b>
                      {metaEta > 0 && (
                        <> · no ritmo de {BRL(c.guardar)}/mês, ~{metaEta} {metaEta === 1 ? 'mês' : 'meses'}</>
                      )}
                    </>
                  ) : (
                    '🎉 Meta atingida! Você já juntou o que planejou.'
                  )}
                </p>
              </>
            ) : (
              <p className="hint" style={{ borderTop: 'none', marginTop: 8, paddingTop: 0 }}>
                Defina quanto quer juntar no total. O progresso usa o que você já guardou nos meses
                fechados (aba Histórico).
              </p>
            )}
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

            <button className="reset" onClick={() => setConfirmReset(true)}>
              ↺ Limpar tudo
            </button>
          </div>
        </div>
      </div>

      {confirmReset && (
        <ConfirmDialog
          title="Limpar todos os dados?"
          message="Isso apaga salário, despesas, assinaturas, cartão, parcelamentos e a meta. Esta ação não pode ser desfeita."
          confirmLabel="Limpar tudo"
          cancelLabel="Cancelar"
          danger
          onConfirm={() => {
            reset();
            setConfirmReset(false);
          }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}
