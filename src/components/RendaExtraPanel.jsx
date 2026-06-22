import React from 'react';
import { BRL } from '../money.js';
import EditableList from './EditableList.jsx';

export default function RendaExtraPanel({ state, c, updateItem, addItem, removeItem }) {
  return (
    <div className="panel">
      <div className="single">
        <div className="card">
          <div className="card-head">
            <span className="card-title">Renda extra do mês</span>
            <span className="card-total">{BRL(c.totRendaExtra)}</span>
          </div>
          <EditableList
            kind="rendaExtra"
            items={state.rendaExtra || []}
            namePlaceholder="De onde veio (freela, venda…)"
            addLabel="Adicionar renda extra"
            updateItem={updateItem}
            addItem={addItem}
            removeItem={removeItem}
          />
          <p className="hint">
            Ganhos avulsos que entraram este mês — freelas, vendas, bônus, presentes. Somam à sua
            renda disponível no planejamento e zeram automaticamente no fechamento do mês.
          </p>
        </div>
      </div>
    </div>
  );
}
