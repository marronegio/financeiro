import React, { useState } from 'react';
import { BRL } from '../money.js';
import { getCardCategories } from '../state.js';
import { fmtPeriodo } from '../history.js';
import { SORTS, ordemCompras, totaisPorCategoria } from '../compras.js';
import EditableList from './EditableList.jsx';
import CategoryManager from './CategoryManager.jsx';
import CategoriasResumo from './CategoriasResumo.jsx';

// Compras pagas na hora: débito, Pix, dinheiro. É o gasto que antes não tinha
// onde entrar — quem paga assim ou não lançava nada (e a sobra do mês ficava
// alta demais) ou lançava no crédito à vista, sujando a fatura e o limite do
// cartão. Aqui o valor entra no total de gastos do planejamento e em mais nada
// do cartão.
export default function DebitoPanel({
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
  const compras = state.debito || [];
  const order = ordemCompras(compras, categories, sort);
  const porCategoria = totaisPorCategoria(compras, categories);

  // Orçamento do mês: a sobra do último mês fechado (ver compute em
  // src/money.js). Antes do primeiro fechamento não há de onde tirá-lo.
  const estourou = c.debitoDisponivel < 0;
  // A barra mede o gasto contra o teto que está valendo — o orçamento ou a
  // sobra do mês corrente, o que for menor. Medir contra o orçamento quando
  // quem segura é a sobra mostraria folga que não existe.
  const teto = c.totDebito + Math.max(0, c.debitoDisponivel);
  const usadoPct = teto > 0 ? Math.max(0, Math.min(100, (c.totDebito / teto) * 100)) : 100;
  const barColor = estourou ? 'var(--negative)' : usadoPct > 85 ? 'var(--expense)' : 'var(--debit)';

  return (
    <div className="panel">
      <div className="grid">
        <div>
          <div className="card">
            <div className="card-head">
              <span className="card-title">Compras no débito</span>
              <span className="card-total">{BRL(c.totDebito)}</span>
            </div>
            {compras.length > 1 && (
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
              kind="debito"
              items={compras}
              namePlaceholder="Ex: Mercado, Uber, farmácia…"
              addLabel="Adicionar gasto"
              categories={categories}
              order={order}
              updateItem={updateItem}
              addItem={addItem}
              removeItem={removeItem}
            />
            <p className="hint">
              Tudo que você pagou na hora — débito, Pix ou dinheiro. Entra no total de gastos do mês,
              mas fica fora da fatura e não ocupa o limite do cartão.
            </p>
          </div>

          {/* A lista de etiquetas é uma só, compartilhada com o crédito à vista:
              editar aqui muda nas duas abas (ver CARD_CATEGORIES em state.js). */}
          <CategoryManager
            categories={categories}
            onAdd={addCategory}
            onUpdate={updateCategory}
            onRemove={removeCategory}
          />
        </div>

        <div className="sticky">
          <div className="card">
            <div className="card-head">
              <span className="card-title">Orçamento do débito</span>
            </div>

            {c.temOrcamentoDebito ? (
              <>
                <div className={'hero ' + (estourou ? 'neg' : 'pos')}>
                  <div className="lo-label">Ainda cabe no débito</div>
                  <div className="lo-value">{BRL(c.debitoDisponivel)}</div>
                  <div className="lo-note">
                    {estourou
                      ? `você passou ${BRL(-c.debitoDisponivel)} do que sobrou em ${fmtPeriodo(c.orcamentoDebitoPeriodo)}`
                      : c.debitoNoTeto
                      ? 'limitado pelo que sobra no mês corrente, não pelo orçamento'
                      : `${BRL(c.totDebito)} gastos de ${BRL(c.orcamentoDebito)}`}
                  </div>
                </div>
                <div className="catline-bar">
                  <span style={{ width: usadoPct + '%', background: barColor }} />
                </div>

                {/* A conta inteira, à vista: sem ela o valor lá em cima parece
                    um número que o app inventou. */}
                <div style={{ marginTop: 14 }}>
                  <div className="summary-line">
                    <span className="lbl">Sobrou em {fmtPeriodo(c.orcamentoDebitoPeriodo)}</span>
                    <span className="amt">{BRL(c.orcamentoDebito)}</span>
                  </div>
                  <div className="summary-line minus">
                    <span className="lbl">Já gasto no débito</span>
                    <span className="amt">{BRL(c.totDebito)}</span>
                  </div>
                  <div className="summary-line total">
                    <span className="lbl">
                      <strong>Ainda cabe</strong>
                    </span>
                    <span
                      className="amt"
                      style={{ color: estourou ? 'var(--negative)' : 'var(--positive)' }}
                    >
                      {BRL(c.debitoDisponivel)}
                    </span>
                  </div>
                </div>
                {c.debitoNoTeto && !estourou && (
                  <p className="hint">
                    Seu orçamento é {BRL(c.orcamentoDebito)}, mas este mês já está mais apertado que
                    o anterior: o que ainda dá para gastar é a sobra do mês corrente,{' '}
                    {BRL(Math.max(0, c.sobra))}.
                  </p>
                )}
                <p className="hint">
                  Seu orçamento é o que sobrou em {fmtPeriodo(c.orcamentoDebitoPeriodo)}, o último mês
                  que você fechou. A cada fechamento ele se atualiza sozinho com a sobra daquele mês.
                </p>
              </>
            ) : (
              <p className="hint">
                O orçamento do débito é o que sobrou no seu último mês fechado — dinheiro que você
                de fato teve na mão. Feche o primeiro mês no Histórico e ele aparece aqui.
              </p>
            )}
          </div>

          <CategoriasResumo categorias={porCategoria} total={c.totDebito} />
        </div>
      </div>
    </div>
  );
}
