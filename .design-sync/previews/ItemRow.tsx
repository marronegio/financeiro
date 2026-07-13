import React, { useState } from 'react';
import { ItemRow } from 'dinprev';

// Linha editável de item (despesas fixas, assinaturas e cartão).

const CATS = [
  { id: 'mercado', label: 'Mercado' },
  { id: 'lazer', label: 'Lazer' },
  { id: 'transporte', label: 'Transporte' },
];

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="card" style={{ maxWidth: 640 }}>{children}</div>
);

export const DespesaFixa = () => {
  const [item, setItem] = useState({ nome: 'Internet', valor: '119,90', venc: '15', pago: '' });
  return (
    <Card>
      <ItemRow item={item} onChange={setItem} onRemove={() => {}} showVenc showPago namePlaceholder="Nome da despesa" />
    </Card>
  );
};

export const DespesaPaga = () => {
  const [item, setItem] = useState({ nome: 'Aluguel', valor: '1.450,00', venc: '5', pago: '2026-07' });
  return (
    <Card>
      <ItemRow item={item} onChange={setItem} onRemove={() => {}} showVenc showPago namePlaceholder="Nome da despesa" />
    </Card>
  );
};

export const ItemDoCartao = () => {
  const [item, setItem] = useState({ nome: 'Mercado da semana', valor: '287,45', cat: 'mercado' });
  return (
    <Card>
      <ItemRow item={item} onChange={setItem} onRemove={() => {}} categories={CATS} namePlaceholder="Compra" />
    </Card>
  );
};

export const Simples = () => {
  const [item, setItem] = useState({ nome: 'Spotify', valor: '21,90' });
  return (
    <Card>
      <ItemRow item={item} onChange={setItem} onRemove={() => {}} namePlaceholder="Assinatura" />
    </Card>
  );
};
