import React, { useState } from 'react';
import { BRL } from '../money.js';
import MoneyField from './MoneyField.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import MetasResumo from './MetasResumo.jsx';
import LimiteCartao from './LimiteCartao.jsx';

export default function PlanejamentoPanel({ state, c, setField, reset, onTab }) {
  const [confirmReset, setConfirmReset] = useState(false);
  // Base para as larguras da barra de composição (renda total disponível no mês).
  const renda = c.salario + c.rendaExtraNoPlano;
  const base = renda > 0 ? renda : c.gastos + c.guardar + Math.max(0, c.sobra) || 1;
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
              <span className="card-title">Cartão de crédito</span>
            </div>
            <MoneyField
              label="Limite do cartão"
              value={state.limiteCartao}
              onChange={(v) => setField('limiteCartao', v)}
            />
            <LimiteCartao c={c} />
            <p className="hint">
              O disponível desconta compras, assinaturas e o saldo das parcelas no cartão.
            </p>
          </div>

          <MetasResumo metas={state.metas} onManage={() => onTab('economias')} />
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
                <span className="dot" style={{ background: 'var(--positive)' }} />
                Sobra
              </div>
            </div>

            <div className="bar">
              <span style={{ background: 'var(--expense)', width: pct(c.gastos) + '%' }} />
              <span style={{ background: 'var(--savings)', width: pct(c.guardar) + '%' }} />
              <span style={{ background: 'var(--positive)', width: pct(Math.max(0, c.sobra)) + '%' }} />
            </div>

            <div>
              <div className="summary-line">
                <span className="lbl">
                  <span className="dot" style={{ background: 'var(--ink)' }} />
                  Salário
                </span>
                <span className="amt">{BRL(c.salario)}</span>
              </div>
              {c.somarRendaExtra && c.totRendaExtra > 0 && (
                <div className="summary-line">
                  <span className="lbl">
                    <span className="dot" style={{ background: 'var(--positive)' }} />
                    Renda extra
                  </span>
                  <span className="amt">+ {BRL(c.totRendaExtra)}</span>
                </div>
              )}
              <div className="summary-line minus">
                <span className="lbl">
                  <span className="dot" style={{ background: 'var(--expense)' }} />
                  Total de gastos
                </span>
                <span className="amt">{BRL(c.gastos)}</span>
              </div>
              {c.totDoacoes > 0 && (
                <div className="summary-line" title="As doações já estão somadas no total de gastos acima.">
                  <span className="lbl">
                    <span className="dot" style={{ background: 'var(--accent)' }} />
                    Doações
                  </span>
                  <span className="amt">{BRL(c.totDoacoes)}</span>
                </div>
              )}
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

            {c.sobra < 0 && renda > 0 && (
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
          message="Isso apaga salário, despesas, assinaturas, doações, cartão, parcelamentos e a meta. Esta ação não pode ser desfeita."
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
