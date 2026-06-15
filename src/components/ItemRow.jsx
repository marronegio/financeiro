import React from 'react';
import { maskMoney } from '../money.js';

// Linha: [categoria opcional] + nome + valor (R$) + remover.
// Usada em despesas, assinaturas e cartão. `categories` só é passado no cartão.
export default function ItemRow({ item, namePlaceholder = 'Nome', onChange, onRemove, categories }) {
  const hasCat = Array.isArray(categories) && categories.length > 0;
  return (
    <div className={'row' + (hasCat ? ' has-cat' : '')}>
      {hasCat && (
        <select
          className="cat-select"
          value={item.cat || ''}
          onChange={(e) => onChange({ ...item, cat: e.target.value })}
          aria-label="Categoria"
        >
          <option value="">Categoria…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      )}
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
