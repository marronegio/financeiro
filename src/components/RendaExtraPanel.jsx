import React from 'react';
import { BRL } from '../money.js';
import EditableList from './EditableList.jsx';

export default function RendaExtraPanel({ state, c, setField, updateItem, addItem, removeItem }) {
  const somar = state.somarRendaExtra !== false;
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
            Ganhos avulsos que entraram este mês — freelas, vendas, bônus, presentes. Zeram
            automaticamente no fechamento do mês.
          </p>

          <div className="cfg-appearance" style={{ marginTop: 14 }}>
            <span className="field-label" style={{ margin: 0 }}>
              Somar no planejamento
            </span>
            <div className="seg">
              <button
                className={somar ? 'active' : ''}
                onClick={() => setField('somarRendaExtra', true)}
              >
                Somar
              </button>
              <button
                className={!somar ? 'active' : ''}
                onClick={() => setField('somarRendaExtra', false)}
              >
                Não somar
              </button>
            </div>
          </div>
          <p className="hint">
            {somar
              ? 'A renda extra está somando à sua renda disponível, aumentando a sobra do planejamento.'
              : 'A renda extra está apenas registrada aqui — não entra na sobra do planejamento.'}
          </p>
        </div>
      </div>
    </div>
  );
}
