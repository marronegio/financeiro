import React from 'react';
import { BRL, maskMoney, onlyDigits, computeParcela } from '../money.js';

function ParcelaCard({ item, onChange, onRemove }) {
  const p = computeParcela(item);

  let meta;
  if (!(p.parc > 0)) {
    meta = 'preencha valor e nº de parcelas';
  } else if (p.done) {
    meta = `${p.parc} de ${p.parc} pagas · quitado`;
  } else {
    meta = (
      <>
        {p.pagas} de {p.parc} pagas · <b>{BRL(p.mensal)}</b>/mês · faltam {BRL(p.falta)}
      </>
    );
  }

  return (
    <div className={'pcard' + (p.done ? ' done' : '')}>
      <div className="pcard-top">
        <div className="name-wrap">
          <input
            className="name-input"
            type="text"
            value={item.nome}
            onChange={(e) => onChange({ ...item, nome: e.target.value })}
            placeholder="Ex: Notebook, Geladeira…"
            autoComplete="off"
          />
        </div>
        <button className="del-btn" title="Remover" onClick={onRemove}>
          ×
        </button>
      </div>

      <div className="pcard-fields">
        <label className="pf">
          <span className="pf-l">Valor total</span>
          <div className="val-wrap">
            <span className="prefix">R$</span>
            <input
              type="text"
              inputMode="numeric"
              value={item.total}
              onChange={(e) => onChange({ ...item, total: maskMoney(e.target.value) })}
              placeholder="0,00"
              autoComplete="off"
            />
          </div>
        </label>
        <label className="pf">
          <span className="pf-l">Nº parcelas</span>
          <div className="val-wrap">
            <input
              type="text"
              inputMode="numeric"
              value={item.parcelas}
              onChange={(e) => onChange({ ...item, parcelas: onlyDigits(e.target.value) })}
              placeholder="12"
              autoComplete="off"
            />
          </div>
        </label>
        <label className="pf">
          <span className="pf-l">Já pagas</span>
          <div className="val-wrap">
            <input
              type="text"
              inputMode="numeric"
              value={item.pagas}
              onChange={(e) => onChange({ ...item, pagas: onlyDigits(e.target.value) })}
              placeholder="0"
              autoComplete="off"
            />
          </div>
        </label>
      </div>

      <div className="pcard-meta">
        <div className="pbar">
          <span style={{ width: p.pct + '%' }} />
        </div>
        <div className="pmeta-text">{meta}</div>
      </div>
    </div>
  );
}

export default function ParcelamentosPanel({ state, c, updateItem, addItem, removeItem }) {
  return (
    <div className="panel">
      <div className="grid">
        <div>
          <div className="card">
            <div className="card-head">
              <span className="card-title">Compras parceladas</span>
              <span className="card-total">{BRL(c.parcelaMensal)} /mês</span>
            </div>
            {state.parcelamentos.map((it, i) => (
              <ParcelaCard
                key={i}
                item={it}
                onChange={(next) => updateItem('parcelamentos', i, next)}
                onRemove={() => removeItem('parcelamentos', i)}
              />
            ))}
            <button className="add-btn" onClick={() => addItem('parcelamentos')}>
              ＋ Adicionar parcelamento
            </button>
            <p className="hint">
              Compras que você dividiu no cartão. A parcela mensal entra na fatura e consome o limite
              de crédito do mês.
            </p>
          </div>
        </div>

        <div className="sticky">
          <div className="card">
            <div className="card-head">
              <span className="card-title">Parcelas em aberto</span>
            </div>
            <div className="hero">
              <div className="lo-label">Parcela mensal total</div>
              <div className="lo-value">{BRL(c.parcelaMensal)}</div>
              <div className="lo-note">compromisso fixo no cartão por mês</div>
            </div>
            <div>
              <div className="summary-line">
                <span className="lbl">
                  <span className="dot" style={{ background: 'var(--credit)' }} />
                  Compras ativas
                </span>
                <span className="amt">{c.parcelaAtivas}</span>
              </div>
              <div className="summary-line">
                <span className="lbl">
                  <span className="dot" style={{ background: 'var(--debit)' }} />
                  Parcela do mês
                </span>
                <span className="amt">{BRL(c.parcelaMensal)}</span>
              </div>
              <div className="summary-line total">
                <span className="lbl">
                  <strong>Falta pagar</strong>
                </span>
                <span className="amt">{BRL(c.parcelaRestante)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
