import React, { useState } from 'react';
import { PinField } from 'dinprev';

// Campo de PIN de 4 dígitos (perfis do plano Duo).

const Wrap = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="pin-dialog-field" style={{ display: 'grid', gap: 6, maxWidth: 220 }}>
    <span className="field-label">{label}</span>
    {children}
  </label>
);

export const Definicao = () => {
  const [v, setV] = useState('1234');
  return (
    <Wrap label="Novo PIN">
      <PinField value={v} onChange={setV} />
    </Wrap>
  );
};

export const DesbloqueioMascarado = () => {
  const [v, setV] = useState('12');
  return (
    <Wrap label="PIN do perfil">
      <PinField value={v} onChange={setV} masked />
    </Wrap>
  );
};

export const Vazio = () => {
  const [v, setV] = useState('');
  return (
    <Wrap label="PIN de 4 dígitos">
      <PinField value={v} onChange={setV} />
    </Wrap>
  );
};
