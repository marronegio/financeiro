import React, { useState } from 'react';
import { EditableList } from 'dinprev';

// Lista editável de itens + botão adicionar (padrão dos painéis de lançamento).

export const DespesasFixas = () => {
  const [items, setItems] = useState([
    { nome: 'Aluguel', valor: '1.450,00', venc: '5', pago: '2026-07' },
    { nome: 'Internet', valor: '119,90', venc: '15', pago: '' },
    { nome: 'Energia', valor: '218,37', venc: '20', pago: '' },
  ]);
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <EditableList
        kind="despesas"
        items={items}
        namePlaceholder="Nome da despesa"
        addLabel="Adicionar despesa"
        showVenc
        showPago
        updateItem={(_k: string, i: number, next: any) =>
          setItems((prev) => prev.map((it, j) => (j === i ? next : it)))}
        addItem={() => setItems((prev) => [...prev, { nome: '', valor: '' }])}
        removeItem={(_k: string, i: number) =>
          setItems((prev) => prev.filter((_, j) => j !== i))}
      />
    </div>
  );
};

export const Assinaturas = () => {
  const [items, setItems] = useState([
    { nome: 'Netflix', valor: '55,90' },
    { nome: 'Spotify', valor: '21,90' },
  ]);
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <EditableList
        kind="assinaturas"
        items={items}
        namePlaceholder="Nome da assinatura"
        addLabel="Adicionar assinatura"
        updateItem={(_k: string, i: number, next: any) =>
          setItems((prev) => prev.map((it, j) => (j === i ? next : it)))}
        addItem={() => setItems((prev) => [...prev, { nome: '', valor: '' }])}
        removeItem={(_k: string, i: number) =>
          setItems((prev) => prev.filter((_, j) => j !== i))}
      />
    </div>
  );
};
