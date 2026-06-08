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
}) {
  return (
    <>
      {items.map((it, i) => (
        <ItemRow
          key={i}
          item={it}
          namePlaceholder={namePlaceholder}
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
