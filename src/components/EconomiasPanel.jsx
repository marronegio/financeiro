import React from 'react';
import MetasEconomia from './MetasEconomia.jsx';

export default function EconomiasPanel({ state, updateItem, addItem, removeItem }) {
  return (
    <div className="panel single">
      <MetasEconomia
        metas={state.metas}
        updateItem={updateItem}
        addItem={addItem}
        removeItem={removeItem}
      />
    </div>
  );
}
