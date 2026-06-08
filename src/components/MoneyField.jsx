import React from 'react';
import { maskMoney } from '../money.js';

// Campo de dinheiro com rótulo (salário, meta de guardar, etc.).
export default function MoneyField({ label, value, onChange, placeholder = '0,00' }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="money-input">
        <span className="prefix">R$</span>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(maskMoney(e.target.value))}
          placeholder={placeholder}
          autoComplete="off"
        />
      </div>
    </label>
  );
}
