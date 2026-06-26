import React from 'react';
import ItemRow from './ItemRow.jsx';

// Lista de ItemRow + botão de adicionar, para uma categoria (kind) do estado.
export default function EditableList({
  kind,
  items,
  namePlaceholder,
  addLabel,
  updateItem,
  addItem,
  removeItem,
  categories,
  showVenc,
  order,
}) {
  // `order` (opcional) é uma lista de índices originais na ordem de exibição —
  // permite reordenar a lista sem alterar os índices usados na edição/remoção.
  const displayOrder = order || items.map((_, i) => i);
  return (
    <>
      {displayOrder.map((i) => (
        <ItemRow
          key={i}
          item={items[i]}
          namePlaceholder={namePlaceholder}
          categories={categories}
          showVenc={showVenc}
          onChange={(next) => updateItem(kind, i, next)}
          onRemove={() => removeItem(kind, i)}
        />
      ))}
      <button className="add-btn" onClick={() => addItem(kind)}>
        ＋ {addLabel}
      </button>
    </>
  );
}
