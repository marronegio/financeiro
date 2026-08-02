import React from 'react';
import { FiLock } from 'react-icons/fi';
import { UPGRADE_REASONS } from '../limits.js';

// Substitui um painel (ou um bloco dentro dele) exclusivo do Pro para quem está
// no plano grátis. Sempre diz o que existe ali e como liberar — uma tela vazia
// ou um item que some do menu passam a sensação de app quebrado, não de plano
// limitado.
export default function ProLocked({ feature, title, hint, onUpgrade, compact = false }) {
  return (
    <div className={'card pro-locked' + (compact ? ' pro-locked-compact' : '')}>
      <span className="pro-locked-ico" aria-hidden="true"><FiLock /></span>
      <h2 className="pro-locked-title">{title}</h2>
      <p className="pro-locked-text">{UPGRADE_REASONS[feature]}</p>
      {hint && <p className="pro-locked-hint">{hint}</p>}
      <button type="button" className="pro-locked-cta" onClick={() => onUpgrade(feature)}>
        Conhecer o Pro
      </button>
    </div>
  );
}
