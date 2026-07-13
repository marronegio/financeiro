import React, { useState } from 'react';
import { Sidebar } from 'dinprev';

// Navegação lateral (shell escuro navy). sticky + 100vh — moldura com altura
// fixa para o card.
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ position: 'relative', height: 720, transform: 'translateZ(0)', overflow: 'hidden', borderRadius: 12, maxWidth: 280 }}>
    {children}
  </div>
);

export const PlanoSolo = () => {
  const [tab, setTab] = useState('plan');
  return (
    <Frame>
      <Sidebar
        tab={tab}
        onTab={setTab}
        user={{ email: 'ana@exemplo.com' }}
        onSignOut={() => {}}
        avatar={null}
      />
    </Frame>
  );
};

export const PlanoDuo = () => {
  const [tab, setTab] = useState('despesas');
  return (
    <Frame>
      <Sidebar
        tab={tab}
        onTab={setTab}
        user={{ email: 'casal@exemplo.com' }}
        onSignOut={() => {}}
        avatar={null}
        isDuo
        activeProfile={{ name: 'Ana' }}
        onOpenProfiles={() => {}}
      />
    </Frame>
  );
};
