import React from 'react';
import { FiCheck } from 'react-icons/fi';
import { passwordChecks } from '../password.js';

// Checklist em tempo real dos requisitos da senha — mesmo componente no
// cadastro, na redefinição por e-mail e na troca de senha em Configurações,
// para o usuário nunca ver uma regra diferente em cada tela. Cada item risca
// em verde assim que a senha digitada passa a cumpri-lo; nada fica vermelho —
// um requisito ainda não cumprido só permanece neutro.
export default function PasswordChecklist({ password }) {
  const checks = passwordChecks(password);
  return (
    <ul className="pw-checklist" aria-live="polite">
      {checks.map((c) => (
        <li key={c.id} className={c.ok ? 'ok' : ''}>
          <span className="pw-checklist-ico" aria-hidden="true">
            {c.ok ? <FiCheck /> : <span className="pw-checklist-dot" />}
          </span>
          {c.label}
        </li>
      ))}
    </ul>
  );
}
