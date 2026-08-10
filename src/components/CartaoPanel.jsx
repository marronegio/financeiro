import React, { useState } from 'react';
import { BRL } from '../money.js';
import { getCardCategories } from '../state.js';
import { SORTS, ordemCompras, totaisPorCategoria } from '../compras.js';
import EditableList from './EditableList.jsx';
import CategoryManager from './CategoryManager.jsx';
import CategoriasResumo from './CategoriasResumo.jsx';
import LimiteCartao from './LimiteCartao.jsx';

export default function CartaoPanel({
  state,
  c,
  updateItem,
  addItem,
  removeItem,
  addCategory,
  updateCategory,
  removeCategory,
}) {
  const [sort, setSort] = useState('add');
  const categories = getCardCategories(state);
  const order = ordemCompras(state.cartao, categories, sort);
  const porCategoria = totaisPorCategoria(state.cartao, categories);

  return (
    <div className="panel">
      <div className="grid">
        <div>
          <div className="card">
            <div className="card-head">
              <span className="card-title">Compras no cartão</span>
              <span className="card-total">{BRL(c.totCartao)}</span>
            </div>
            {state.cartao.length > 1 && (
              <div className="list-sort">
                <span className="list-sort-lbl">Ordenar por</span>
                <div className="seg">
                  {SORTS.map((s) => (
                    <button
                      key={s.id}
                      className={sort === s.id ? 'active' : ''}
                      onClick={() => setSort(s.id)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <EditableList
              kind="cartao"
              items={state.cartao}
              namePlaceholder="Ex: Mercado, iFood…"
              addLabel="Adicionar compra"
              categories={categories}
              order={order}
              updateItem={updateItem}
              addItem={addItem}
              removeItem={removeItem}
            />
            <p className="hint">
              Some aqui as compras do cartão e marque a categoria de cada uma. Elas entram na fatura
              junto com a parcela do mês dos seus parcelamentos.
            </p>
          </div>

          <CategoryManager
            categories={categories}
            onAdd={addCategory}
            onUpdate={updateCategory}
            onRemove={removeCategory}
          />

          <div className="card">
            <div className="card-head">
              <span className="card-title">Abates</span>
              <span className="card-total" style={{ color: 'var(--positive)' }}>
                {c.totAbates > 0 ? '− ' : ''}{BRL(c.totAbates)}
              </span>
            </div>
            <EditableList
              kind="abates"
              items={state.abates || []}
              namePlaceholder="Ex: Estorno, cashback, crédito…"
              addLabel="Adicionar abate"
              updateItem={updateItem}
              addItem={addItem}
              removeItem={removeItem}
            />
            <p className="hint">
              Valores descontados da fatura — estornos, cashback, créditos. São subtraídos do total a
              pagar.
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
              <div className="lo-note">
                {c.totAbates > 0
                  ? 'compras + assinaturas + parcelas − abates'
                  : 'compras + assinaturas + parcelas do mês'}
              </div>
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
                  <span className="dot" style={{ background: '#9b6bff' }} />
                  Assinaturas
                </span>
                <span className="amt">{BRL(c.totAss)}</span>
              </div>
              <div className="summary-line">
                <span className="lbl">
                  <span className="dot" style={{ background: 'var(--debit)' }} />
                  Parcelas do mês
                </span>
                <span className="amt">{BRL(c.parcelaMensalCartao)}</span>
              </div>
              {c.totAbates > 0 && (
                <div className="summary-line">
                  <span className="lbl">
                    <span className="dot" style={{ background: 'var(--positive)' }} />
                    Abates
                  </span>
                  <span className="amt" style={{ color: 'var(--positive)' }}>
                    − {BRL(c.totAbates)}
                  </span>
                </div>
              )}
              <div className="summary-line total">
                <span className="lbl">
                  <strong>Total da fatura</strong>
                </span>
                <span className="amt">{BRL(c.faturaCartao)}</span>
              </div>
            </div>
          </div>

          <LimiteCartao c={c} card />

          <CategoriasResumo categorias={porCategoria} total={c.totCartao} />
        </div>
      </div>
    </div>
  );
}
