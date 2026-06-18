import React from 'react';
import { BRL, maskMoney, toNumber, onlyDigits } from '../money.js';

// Máscara de data "mm/aa" enquanto digita.
function maskMmAa(v) {
  const d = onlyDigits(v).slice(0, 4);
  if (d.length <= 2) return d;
  return d.slice(0, 2) + '/' + d.slice(2);
}

// Meses entre hoje e o prazo "mm/aa". Negativo = vencido; null = inválido/sem prazo.
function monthsUntil(prazo) {
  const d = onlyDigits(prazo);
  if (d.length < 4) return null;
  const m = parseInt(d.slice(0, 2), 10);
  const yy = parseInt(d.slice(2, 4), 10);
  if (!m || m < 1 || m > 12) return null;
  const year = 2000 + yy;
  const now = new Date();
  return (year - now.getFullYear()) * 12 + (m - (now.getMonth() + 1));
}

function GoalCard({ item, onChange, onRemove }) {
  const alvo = toNumber(item.valor);
  const juntado = toNumber(item.guardado);
  const falta = Math.max(0, alvo - juntado);
  const pct = alvo > 0 ? Math.max(0, Math.min(100, (juntado / alvo) * 100)) : 0;
  const done = alvo > 0 && juntado >= alvo;
  const months = monthsUntil(item.prazo);

  let nota;
  if (alvo <= 0) {
    nota = 'Defina o valor da meta.';
  } else if (done) {
    nota = '🎉 Meta atingida!';
  } else if (months === null) {
    nota = <>Faltam <b>{BRL(falta)}</b>.</>;
  } else if (months < 0) {
    nota = <>Prazo vencido · faltam <b>{BRL(falta)}</b>.</>;
  } else if (months === 0) {
    nota = <>Faltam <b>{BRL(falta)}</b> · até {item.prazo}.</>;
  } else {
    nota = <>Faltam <b>{BRL(falta)}</b> · <b>{BRL(falta / months)}</b>/mês até {item.prazo}.</>;
  }

  return (
    <div className={'goal' + (done ? ' done' : '')}>
      <div className="goal-head">
        <input
          className="goal-name"
          type="text"
          value={item.nome}
          onChange={(e) => onChange({ ...item, nome: e.target.value })}
          placeholder="Nome da meta (ex: Viagem)"
          autoComplete="off"
        />
        <button className="del-btn" title="Remover" onClick={onRemove}>×</button>
      </div>

      <div className="goal-bar">
        <span style={{ width: pct + '%', background: 'var(--positive)' }} />
      </div>
      <div className="goal-stats">
        <span>{BRL(juntado)} <span className="goal-of">de {BRL(alvo)}</span></span>
        <span className="goal-pct">{Math.round(pct)}%</span>
      </div>

      <div className="goal-fields">
        <label className="goal-f">
          <span className="goal-f-l">Meta total</span>
          <div className="goal-box">
            <span className="prefix">R$</span>
            <input
              type="text"
              inputMode="numeric"
              value={item.valor}
              onChange={(e) => onChange({ ...item, valor: maskMoney(e.target.value) })}
              placeholder="0,00"
              autoComplete="off"
            />
          </div>
        </label>
        <label className="goal-f">
          <span className="goal-f-l">Já juntei</span>
          <div className="goal-box">
            <span className="prefix">R$</span>
            <input
              type="text"
              inputMode="numeric"
              value={item.guardado}
              onChange={(e) => onChange({ ...item, guardado: maskMoney(e.target.value) })}
              placeholder="0,00"
              autoComplete="off"
            />
          </div>
        </label>
        <label className="goal-f">
          <span className="goal-f-l">Até (mm/aa)</span>
          <div className="goal-box">
            <input
              type="text"
              inputMode="numeric"
              value={item.prazo}
              onChange={(e) => onChange({ ...item, prazo: maskMmAa(e.target.value) })}
              placeholder="mm/aa"
              autoComplete="off"
            />
          </div>
        </label>
      </div>

      <p className="goal-note">{nota}</p>
    </div>
  );
}

export default function MetasEconomia({ metas, updateItem, addItem, removeItem }) {
  const list = metas || [];
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Metas de economia</span>
        <span className="card-total">{list.length} {list.length === 1 ? 'meta' : 'metas'}</span>
      </div>

      {list.map((it, i) => (
        <GoalCard
          key={i}
          item={it}
          onChange={(next) => updateItem('metas', i, next)}
          onRemove={() => removeItem('metas', i)}
        />
      ))}

      <button className="add-btn" onClick={() => addItem('metas')}>
        ＋ Adicionar meta
      </button>
      <p className="hint">
        Defina quanto quer juntar e até quando (mm/aa). Atualize "já juntei" conforme guarda — o app
        mostra quanto poupar por mês pra chegar no prazo.
      </p>
    </div>
  );
}
