import React, { useState } from 'react';
import { PasswordInput } from 'dinprev';

// Campo de senha com botão de olho (mostrar/ocultar).

const Wrap = ({ children }: { children: React.ReactNode }) => (
  <div style={{ maxWidth: 360 }}>{children}</div>
);

export const Vazio = () => {
  const [v, setV] = useState('');
  return (
    <Wrap>
      <PasswordInput value={v} onChange={(e: any) => setV(e.target.value)} />
    </Wrap>
  );
};

export const Preenchido = () => {
  const [v, setV] = useState('minhasenha123');
  return (
    <Wrap>
      <PasswordInput value={v} onChange={(e: any) => setV(e.target.value)} />
    </Wrap>
  );
};
