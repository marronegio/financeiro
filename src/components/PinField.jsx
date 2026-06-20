import React from 'react';

// Campo de PIN de 4 dígitos (só dígitos). `masked` esconde os números (uso em
// desbloqueio); visível na definição, pra evitar erro de digitação sem confirmar.
// `onComplete` dispara quando o 4º dígito é preenchido (permite auto-submeter).
export default function PinField({ value, onChange, masked = false, autoFocus = false, onComplete }) {
  return (
    <input
      className="pg-pin-input"
      inputMode="numeric"
      autoComplete="off"
      type={masked ? 'password' : 'text'}
      value={value}
      maxLength={4}
      autoFocus={autoFocus}
      placeholder="••••"
      aria-label="PIN de 4 dígitos"
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, '').slice(0, 4);
        onChange(v);
        if (v.length === 4) onComplete?.(v);
      }}
    />
  );
}
