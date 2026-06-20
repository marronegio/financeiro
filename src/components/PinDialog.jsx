import React, { useEffect, useState } from 'react';
import PinField from './PinField.jsx';

// Modal para gerenciar o PIN de um perfil: adicionar, trocar ou remover.
// Trocar e remover exigem o PIN atual (conferido por `verify`). Quem esqueceu o
// PIN atual usa o caminho de recuperação, fora deste modal.
//
// mode: 'add' | 'change' | 'remove'
export default function PinDialog({ mode, profileName, verify, onConfirm, onCancel }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [err, setErr] = useState('');

  const needsCurrent = mode === 'change' || mode === 'remove';
  const needsNext = mode === 'add' || mode === 'change';

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const title =
    mode === 'add' ? 'Adicionar PIN' : mode === 'change' ? 'Trocar PIN' : 'Remover PIN';

  function submit(e) {
    e.preventDefault();
    setErr('');
    if (needsCurrent && !verify?.(current)) {
      setErr('PIN atual incorreto.');
      setCurrent('');
      return;
    }
    if (needsNext && next.length !== 4) {
      setErr('O novo PIN deve ter 4 dígitos.');
      return;
    }
    // 'remove' envia pin vazio → o hook apaga o PIN.
    onConfirm?.(needsNext ? next : '');
  }

  return (
    <div className="ob-backdrop" onClick={onCancel}>
      <form className="ob-card pin-dialog" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 className="ob-title">{title}</h2>
        <p className="ob-desc">
          {mode === 'add' && <>Defina um PIN de 4 dígitos para entrar no perfil <b>{profileName}</b>.</>}
          {mode === 'change' && <>Confirme o PIN atual e escolha o novo PIN do perfil <b>{profileName}</b>.</>}
          {mode === 'remove' && <>Confirme o PIN atual para remover a proteção do perfil <b>{profileName}</b>.</>}
        </p>

        {needsCurrent && (
          <label className="pin-dialog-field">
            <span className="field-label">PIN atual</span>
            <PinField value={current} onChange={(v) => { setCurrent(v); setErr(''); }} masked autoFocus />
          </label>
        )}

        {needsNext && (
          <label className="pin-dialog-field">
            <span className="field-label">Novo PIN</span>
            <PinField value={next} onChange={(v) => { setNext(v); setErr(''); }} autoFocus={!needsCurrent} />
          </label>
        )}

        {err && <p className="cfg-msg cfg-err" style={{ marginTop: 0 }}>{err}</p>}

        {needsCurrent && (
          <p className="hint" style={{ marginTop: 0, marginBottom: 4 }}>
            Esqueceu o PIN atual? Use <b>“Esqueci o PIN”</b> na tela de perfis (botão Perfil na barra
            lateral) e confirme a senha da conta.
          </p>
        )}

        <div className="ob-actions">
          <button type="button" className="ob-skip" onClick={onCancel}>Voltar</button>
          <button
            type="submit"
            className={mode === 'remove' ? 'btn-danger' : 'ob-next'}
            disabled={(needsCurrent && current.length !== 4) || (needsNext && next.length !== 4)}
          >
            {mode === 'remove' ? 'Remover PIN' : 'Salvar PIN'}
          </button>
        </div>
      </form>
    </div>
  );
}
