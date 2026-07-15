import React from 'react';
import { BRL } from '../money.js';
import EditableList from './EditableList.jsx';

export default function DoacoesPanel({ state, c, updateItem, addItem, removeItem }) {
  return (
    <div className="panel">
      <div className="single">
        <div className="card">
          <div className="card-head">
            <span className="card-title">Doações</span>
            <span className="card-total">{BRL(c.totDoacoes)}</span>
          </div>
          <EditableList
            kind="doacoes"
            items={state.doacoes || []}
            namePlaceholder="Nome"
            addLabel="Adicionar doação"
            showRecorrente
            updateItem={updateItem}
            addItem={addItem}
            removeItem={removeItem}
          />
          <p className="hint">
            Suas doações do mês. Marque o ícone de repetição nas que se repetem todo mês, assim
            você não precisa cadastrá-las de novo — elas somam aos seus gastos do Planejamento.
          </p>
        </div>
      </div>
    </div>
  );
}
