import React, { useState } from 'react';
import EyeIcon from './EyeIcon.jsx';

// Campo de senha com botão de "olho" para mostrar/ocultar. Usa o estilo .auth-input.
export default function PasswordInput({ value, onChange, placeholder = '••••••••', autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-wrap">
      <input
        type={show ? 'text' : 'password'}
        className="auth-input pw-input"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="pw-eye"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
      >
        <EyeIcon off={show} />
      </button>
    </div>
  );
}
