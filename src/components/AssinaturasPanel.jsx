import React from 'react';
import { BRL } from '../money.js';
import EditableList from './EditableList.jsx';

export default function AssinaturasPanel({ state, c, updateItem, addItem, removeItem }) {
  return (
    <div className="panel">
      <div className="single">
        <div className="card">
          <div className="card-head">
            <span className="card-title">Assinaturas</span>
            <span className="card-total">{BRL(c.totAss)}</span>
          </div>
          <EditableList
            kind="assinaturas"
            items={state.assinaturas}
            namePlaceholder="Nome"
            addLabel="Adicionar assinatura"
            updateItem={updateItem}
            addItem={addItem}
            removeItem={removeItem}
          />
          <p className="hint">
            Serviços recorrentes — streaming, apps, academia. Somadas às despesas, compõem seus
            gastos do mês.
          </p>
        </div>
      </div>
    </div>
  );
}
