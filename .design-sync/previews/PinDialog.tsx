import React from 'react';
import { PinDialog } from 'dinprev';

// Modal de gerenciar PIN (adicionar / trocar / remover) — backdrop fixed
// contido pela moldura com transform.
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ position: 'relative', height: 480, transform: 'translateZ(0)', overflow: 'hidden', borderRadius: 12 }}>
    {children}
  </div>
);

export const AdicionarPin = () => (
  <Frame>
    <PinDialog mode="add" profileName="Ana" verify={() => true} onConfirm={() => {}} onCancel={() => {}} />
  </Frame>
);

export const TrocarPin = () => (
  <Frame>
    <PinDialog mode="change" profileName="Bruno" verify={() => true} onConfirm={() => {}} onCancel={() => {}} />
  </Frame>
);

export const RemoverPin = () => (
  <Frame>
    <PinDialog mode="remove" profileName="Ana" verify={() => true} onConfirm={() => {}} onCancel={() => {}} />
  </Frame>
);
