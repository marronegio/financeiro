import React, { useEffect } from 'react';

// Modal de confirmação padronizado (substitui window.confirm em todo o app).
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Voltar',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  // Fecha com Esc.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div className="ob-backdrop" onClick={() => !busy && onCancel?.()}>
      <div className="ob-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="ob-title">{title}</h2>
        {message && <p className="ob-desc">{message}</p>}
        <div className="ob-actions">
          <button className="ob-skip" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={danger ? 'btn-danger' : 'ob-next'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Aguarde…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
