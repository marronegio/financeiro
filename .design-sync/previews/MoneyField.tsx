import React, { useState } from 'react';
import { MoneyField } from 'dinprev';

// Campo de dinheiro com máscara pt-BR (prefixo R$).

export const Salario = () => {
  const [v, setV] = useState('4.500,00');
  return <MoneyField label="Salário do mês" value={v} onChange={setV} />;
};

export const Vazio = () => {
  const [v, setV] = useState('');
  return <MoneyField label="Meta de guardar" value={v} onChange={setV} />;
};

export const PlaceholderCustom = () => {
  const [v, setV] = useState('');
  return (
    <MoneyField label="Renda extra (opcional)" value={v} onChange={setV} placeholder="850,00" />
  );
};
