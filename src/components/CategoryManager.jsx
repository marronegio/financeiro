import React, { useState } from 'react';

const NEW_COLOR = '#635bff';

// Gerenciador das categorias de compra do cartão: criar, renomear, recolorir e
// remover etiquetas. A categoria "Outros" é o destino das compras sem etiqueta,
// então não pode ser removida (mas pode ser renomeada/recolorida).
export default function CategoryManager({ categories, onAdd, onUpdate, onRemove }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [color, setColor] = useState(NEW_COLOR);

  const add = () => {
    if (!nome.trim()) return;
    onAdd(nome, color);
    setNome('');
    setColor(NEW_COLOR);
  };

  return (
    <div className="card">
      <div
        className="card-head cat-mgr-head"
        onClick={() => setOpen((o) => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen((o) => !o)}
      >
        <span className="card-title">Categorias</span>
        <span className="cat-mgr-toggle">{open ? '▴' : '▾'}</span>
      </div>

      {open && (
        <div className="cat-mgr">
          {categories.map((cat) => (
            <div className="cat-mgr-row" key={cat.id}>
              <input
                type="color"
                className="cat-color"
                value={cat.color}
                onChange={(e) => onUpdate(cat.id, { color: e.target.value })}
                aria-label={`Cor de ${cat.label}`}
              />
              <input
                className="cat-name-input"
                type="text"
                value={cat.label}
                onChange={(e) => onUpdate(cat.id, { label: e.target.value })}
                aria-label="Nome da categoria"
                autoComplete="off"
              />
              {cat.id === 'outros' ? (
                <span className="cat-lock" title="Categoria padrão das compras sem etiqueta">
                  ⤓
                </span>
              ) : (
                <button
                  className="del-btn"
                  title="Remover categoria"
                  onClick={() => onRemove(cat.id)}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          <div className="cat-mgr-row cat-mgr-add">
            <input
              type="color"
              className="cat-color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Cor da nova categoria"
            />
            <input
              className="cat-name-input"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Nova categoria…"
              autoComplete="off"
            />
            <button
              className="cat-add-btn"
              title="Adicionar categoria"
              onClick={add}
              disabled={!nome.trim()}
            >
              ＋
            </button>
          </div>

          <p className="hint">
            Crie e edite as etiquetas das suas compras. Ao remover uma categoria, as compras
            marcadas com ela voltam a ficar sem etiqueta.
          </p>
        </div>
      )}
    </div>
  );
}
