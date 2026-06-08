import React from 'react';
import { BRL } from '../money.js';
import EditableList from './EditableList.jsx';

export default function CartaoPanel({ state, c, updateItem, addItem, removeItem }) {
  const saldo = c.credito - c.faturaCartao;
  const positive = saldo >= 0;
  const used = c.credito > 0 ? (c.faturaCartao / c.credito) * 100 : c.faturaCartao > 0 ? 100 : 0;
  const over = used > 100;

  return (
    <div className="panel">
      <div className="grid">
        <div>
          <div className="card">
            <div className="card-head">
              <span className="card-title">Compras no cartão</span>
              <span className="card-total">{BRL(c.totCartao)}</span>
            </div>
            <EditableList
              kind="cartao"
              items={state.cartao}
              namePlaceholder="Ex: Mercado, iFood…"
              addLabel="Adicionar compra"
              updateItem={updateItem}
              addItem={addItem}
              removeItem={removeItem}
            />
            <p className="hint">
              Seu limite vem do planejamento: <b>{BRL(c.credito)}</b> ({c.pctC}% da sobra).
            </p>
          </div>
        </div>

        <div className="sticky">
          <div className="card">
            <div className="card-head">
              <span className="card-title">Fatura x Limite</span>
            </div>

            <div className={'hero ' + (positive ? 'pos' : 'neg')}>
              <div className="lo-label">{positive ? 'Ainda dá pra gastar' : 'Estourou o limite em'}</div>
              <div className="lo-value">{BRL(positive ? saldo : Math.abs(saldo))}</div>
              <div className="lo-note">
                {positive ? 'dentro do limite do crédito' : 'acima do limite planejado'}
              </div>
            </div>

            <div className="usage-meta">
              <span>{Math.round(used)}% usado</span>
              <span>de {BRL(c.credito)}</span>
            </div>
            <div className={'usage-bar' + (over ? ' over' : '')}>
              <span style={{ width: Math.min(100, used) + '%' }} />
            </div>

            <div>
              <div className="summary-line">
                <span className="lbl">
                  <span className="dot" style={{ background: 'var(--credit)' }} />
                  Limite do crédito
                </span>
                <span className="amt">{BRL(c.credito)}</span>
              </div>
              <div className="summary-line minus">
                <span className="lbl">
                  <span className="dot" style={{ background: 'var(--expense)' }} />
                  Gasto no cartão
                </span>
                <span className="amt">{BRL(c.totCartao)}</span>
              </div>
              <div className="summary-line minus">
                <span className="lbl">
                  <span className="dot" style={{ background: 'var(--debit)' }} />
                  Parcelas do mês
                </span>
                <span className="amt">{BRL(c.parcelaMensal)}</span>
              </div>
              <div className="summary-line total">
                <span className="lbl">
                  <strong>Saldo do limite</strong>
                </span>
                <span
                  className="amt"
                  style={{ color: positive ? 'var(--positive)' : 'var(--negative)' }}
                >
                  {BRL(saldo)}
                </span>
              </div>
            </div>

            {saldo < 0 && c.credito > 0 && (
              <div className="warn show">
                <span>⚠</span>
                <span>Você ultrapassou o limite de crédito planejado.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
