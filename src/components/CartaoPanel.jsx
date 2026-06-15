import React from 'react';
import { BRL, toNumber } from '../money.js';
import { CARD_CATEGORIES } from '../state.js';
import EditableList from './EditableList.jsx';

export default function CartaoPanel({ state, c, updateItem, addItem, removeItem }) {
  // Total por categoria (itens sem categoria contam como "Outros").
  const porCategoria = CARD_CATEGORIES.map((cat) => ({
    ...cat,
    total: state.cartao.reduce(
      (s, it) => s + ((it.cat || 'outros') === cat.id ? toNumber(it.valor) : 0),
      0
    ),
  }))
    .filter((cat) => cat.total > 0)
    .sort((a, b) => b.total - a.total);

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
              categories={CARD_CATEGORIES}
              updateItem={updateItem}
              addItem={addItem}
              removeItem={removeItem}
            />
            <p className="hint">
              Some aqui as compras do cartão e marque a categoria de cada uma. Elas entram na fatura
              junto com a parcela do mês dos seus parcelamentos.
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

          {porCategoria.length > 0 && (
            <div className="card">
              <div className="card-head">
                <span className="card-title">Gastos por categoria</span>
              </div>
              {porCategoria.map((cat) => (
                <div className="catline" key={cat.id}>
                  <div className="catline-top">
                    <span className="catline-lbl">
                      <span className="dot" style={{ background: cat.color }} />
                      {cat.label}
                    </span>
                    <span className="catline-amt">{BRL(cat.total)}</span>
                  </div>
                  <div className="catline-bar">
                    <span
                      style={{
                        width: (c.totCartao > 0 ? (cat.total / c.totCartao) * 100 : 0) + '%',
                        background: cat.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
