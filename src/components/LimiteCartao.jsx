import React from 'react';
import { BRL } from '../money.js';

// Leitura do limite de crédito ainda disponível. Aparece no Planejamento (junto
// do campo onde o limite é informado), no Cartão e nos Parcelamentos. Fica
// oculto enquanto o usuário não informar um limite (> 0).
//
// `card`: quando true, envolve o bloco num cartão próprio (colunas laterais das
// abas Cartão/Parcelamentos); quando false, renderiza só o bloco (para embutir
// abaixo do campo no Planejamento).
export default function LimiteCartao({ c, card = false }) {
  if (!(c.limiteCartao > 0)) return null;

  const { limiteCartao, limiteUsado, limiteDisponivel } = c;
  const usadoPct = Math.max(0, Math.min(100, (limiteUsado / limiteCartao) * 100));
  const estourou = limiteDisponivel < 0;
  const barColor = estourou
    ? 'var(--negative)'
    : usadoPct > 85
    ? 'var(--expense)'
    : 'var(--credit)';

  const inner = (
    <div className="limite-box">
      <div className="limite-top">
        <span className="limite-lbl">Limite disponível</span>
        <span
          className="limite-val"
          style={{ color: estourou ? 'var(--negative)' : 'var(--positive)' }}
        >
          {BRL(limiteDisponivel)}
        </span>
      </div>
      <div className="catline-bar">
        <span style={{ width: usadoPct + '%', background: barColor }} />
      </div>
      <div className="limite-note">
        {estourou
          ? `Você passou ${BRL(-limiteDisponivel)} do limite de ${BRL(limiteCartao)}.`
          : `${BRL(limiteUsado)} em uso de ${BRL(limiteCartao)}`}
      </div>
    </div>
  );

  if (!card) return inner;

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Limite do cartão</span>
      </div>
      {inner}
    </div>
  );
}
