import React from 'react';
import { BRL } from '../money.js';
import EditableList from './EditableList.jsx';

export default function CartaoPanel({ state, c, updateItem, addItem, removeItem }) {
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
              Some aqui as compras do cartão. Elas entram na fatura junto com a parcela do mês dos
              seus parcelamentos.
            </p>
          </div>
        </div>

        <div className="sticky">
          <div className="card">
            <div className="card-head">
              <span className="card-title">Resumo da fatura</span>
            </div>

            <div className="hero">
              <div className="lo-label">Total da fatura</div>
              <div className="lo-value">{BRL(c.faturaCartao)}</div>
              <div className="lo-note">compras no cartão + parcelas do mês</div>
            </div>

            <div>
              <div className="summary-line">
                <span className="lbl">
                  <span className="dot" style={{ background: 'var(--credit)' }} />
                  Gasto no cartão
                </span>
                <span className="amt">{BRL(c.totCartao)}</span>
              </div>
              <div className="summary-line">
                <span className="lbl">
                  <span className="dot" style={{ background: 'var(--debit)' }} />
                  Parcelas do mês
                </span>
                <span className="amt">{BRL(c.parcelaMensal)}</span>
              </div>
              <div className="summary-line total">
                <span className="lbl">
                  <strong>Total da fatura</strong>
                </span>
                <span className="amt">{BRL(c.faturaCartao)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
