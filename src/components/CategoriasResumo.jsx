import React from 'react';
import { BRL } from '../money.js';

// Barras de "gastos por categoria" de uma lista de compras avulsas. Usada pelo
// crédito à vista e pelo débito — cada aba mostra as suas, com as mesmas
// etiquetas (ver CARD_CATEGORIES em src/state.js). Some quando não há gasto
// nenhum categorizado.
export default function CategoriasResumo({ categorias, total, titulo = 'Gastos por categoria' }) {
  if (!categorias.length) return null;

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">{titulo}</span>
      </div>
      {categorias.map((cat) => (
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
                width: (total > 0 ? (cat.total / total) * 100 : 0) + '%',
                background: cat.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
