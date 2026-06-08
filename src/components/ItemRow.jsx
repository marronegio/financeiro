import React from 'react';
import { maskMoney } from '../money.js';

// Linha: nome + valor (R$) + remover. Usada em despesas, assinaturas e cartão.
export default function ItemRow({ item, namePlaceholder = 'Nome', onChange, onRemove }) {
  return (
    <div className="row">
      <div className="name-wrap">
        <input
          className="name-input"
          type="text"
          value={item.nome}
          onChange={(e) => onChange({ ...item, nome: e.target.value })}
          placeholder={namePlaceholder}
          autoComplete="off"
        />
      </div>
      <div className="val-wrap">
        <span className="prefix">R$</span>
        <input
          type="text"
          inputMode="numeric"
          value={item.valor}
          onChange={(e) => onChange({ ...item, valor: maskMoney(e.target.value) })}
          placeholder="0,00"
          autoComplete="off"
        />
      </div>
      <button className="del-btn" title="Remover" onClick={onRemove}>
        ×
      </button>
    </div>
  );
}
