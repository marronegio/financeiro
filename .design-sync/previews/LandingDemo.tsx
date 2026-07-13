import React from 'react';
import { LandingDemo } from 'dinprev';

// Janela de demonstração da landing. A classe .reveal começa com opacity:0 e
// espera o IntersectionObserver da landing — no preview forçamos visível.
export const Demo = () => (
  <div style={{ maxWidth: 860 }}>
    <style>{'.reveal{opacity:1!important;transform:none!important}'}</style>
    <LandingDemo />
  </div>
);
