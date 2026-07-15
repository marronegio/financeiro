import React from 'react';
import { FiRepeat } from 'react-icons/fi';
import { maskMoney } from '../money.js';
import { duePeriodFor } from '../despesaAlerts.js';

// Mantém só dígitos e limita o dia de vencimento ao intervalo 1–31.
const maskDia = (raw) => {
  const d = raw.replace(/\D/g, '').slice(0, 2);
  if (d === '') return '';
  const n = Math.min(31, parseInt(d, 10));
  return String(n);
};

// Linha: [pago/recorrente opcional] + [categoria opcional] + nome + [vencimento opcional] + valor (R$) + remover.
// Usada em despesas, assinaturas, cartão e doações. `categories` só é passado no cartão;
// `showVenc` e `showPago` só são passados nas despesas fixas; `showRecorrente` nas doações.
export default function ItemRow({
  item,
  namePlaceholder = 'Nome',
  onChange,
  onRemove,
  categories,
  showVenc = false,
  showPago = false,
  showRecorrente = false,
}) {
  const hasCat = Array.isArray(categories) && categories.length > 0;
  // `pago` guarda o período pago ('YYYY-MM'); qualquer valor = marcado como pago.
  // Zera no fechamento do mês (history.performClose), desmarcando o check.
  const paid = !!item.pago;
  const recorrente = !!item.recorrente;
  return (
    <div
      className={
        'row' +
        (hasCat ? ' has-cat' : '') +
        (showVenc ? ' has-venc' : '') +
        (showPago ? ' has-pago' : '') +
        (showPago && paid ? ' is-paid' : '') +
        (showRecorrente ? ' has-recorrente' : '')
      }
    >
      {showPago && (
        <button
          type="button"
          className={'pago-btn' + (paid ? ' on' : '')}
          onClick={() => onChange({ ...item, pago: paid ? '' : duePeriodFor(item) })}
          title={paid ? 'Paga — clique para desmarcar' : 'Marcar como paga'}
          aria-pressed={paid}
          aria-label={paid ? 'Despesa paga' : 'Marcar despesa como paga'}
        >
          {paid ? '✓' : ''}
        </button>
      )}
      {showRecorrente && (
        <button
          type="button"
          className={'recorrente-btn' + (recorrente ? ' on' : '')}
          onClick={() => onChange({ ...item, recorrente: !recorrente })}
          title={recorrente ? 'Recorrente — clique para desmarcar' : 'Marcar como recorrente'}
          aria-pressed={recorrente}
          aria-label={recorrente ? 'Doação recorrente' : 'Marcar doação como recorrente'}
        >
          <FiRepeat size={15} aria-hidden="true" />
        </button>
      )}
      {hasCat && (
        <select
          className="cat-select"
          value={item.cat || ''}
          onChange={(e) => onChange({ ...item, cat: e.target.value })}
          aria-label="Categoria"
        >
          <option value="">Categoria…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      )}
      <div className="name-wrap">
        <input
          className="name-input"
          type="text"
          value={item.nome}
          onChange={(e) => onChange({ ...item, nome: e.target.value })}
          placeholder={namePlaceholder}
          autoComplete="off"
        />
      </div>
      {showVenc && (
        <div className="venc-wrap" title="Dia do vencimento">
          <span className="prefix">dia</span>
          <input
            type="text"
            inputMode="numeric"
            value={item.venc || ''}
            onChange={(e) => onChange({ ...item, venc: maskDia(e.target.value) })}
            placeholder="—"
            aria-label="Dia do vencimento"
            autoComplete="off"
          />
        </div>
      )}
      <div className="val-wrap">
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
      <button className="del-btn" title="Remover" onClick={onRemove}>
        ×
      </button>
    </div>
  );
}
