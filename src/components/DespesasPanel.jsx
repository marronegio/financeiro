import React from 'react';
import { BRL } from '../money.js';
import EditableList from './EditableList.jsx';

export default function DespesasPanel({ state, c, updateItem, addItem, removeItem }) {
  return (
    <div className="panel">
      <div className="single">
        <div className="card">
          <div className="card-head">
            <span className="card-title">Despesas fixas</span>
            <span className="card-total">{BRL(c.totDesp)}</span>
          </div>
          <EditableList
            kind="despesas"
            items={state.despesas}
            namePlaceholder="Nome"
            addLabel="Adicionar despesa"
            showVenc
            showPago
            updateItem={updateItem}
            addItem={addItem}
            removeItem={removeItem}
          />
          <p className="hint">
            Contas que se repetem todo mês — aluguel, luz, água, internet. Elas entram no total de
            gastos do Planejamento. Use o ✓ à esquerda para marcar as que já pagou; ele é
            desmarcado sozinho quando o mês é fechado.
          </p>
        </div>
      </div>
    </div>
  );
}
