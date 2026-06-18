import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthContext.jsx';
import PasswordInput from './PasswordInput.jsx';

// Mostrada quando o usuário abre o link de recuperação de senha do e-mail.
export default function ResetPasswordScreen() {
  const { clearRecovery } = useAuth();
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (senha.length < 6) {
      setError('A senha precisa ter ao menos 6 caracteres.');
      return;
    }
    if (senha !== confirmar) {
      setError('As senhas não coincidem.');
      return;
    }
    setBusy(true);
    const { error: updErr } = await supabase.auth.updateUser({ password: senha });
    setBusy(false);
    if (updErr) {
      setError(updErr.message || 'Não foi possível redefinir a senha. Tente novamente.');
      return;
    }
    setOk(true);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="logo"><img src="/logo.png" alt="DinPrev" /></span>
          <div>
            <div className="brand-name">DinPrev</div>
            <div className="brand-sub">Finanças pessoais</div>
          </div>
        </div>

        {ok ? (
          <>
            <h2 className="auth-title">Senha redefinida!</h2>
            <p className="auth-lead">Sua nova senha já está valendo. Você pode continuar.</p>
            <button className="auth-submit" onClick={clearRecovery}>
              Ir para o app
            </button>
          </>
        ) : (
          <>
            <h2 className="auth-title">Definir nova senha</h2>
            <p className="auth-lead">Escolha uma nova senha para a sua conta.</p>

            <form onSubmit={submit} noValidate>
              <label className="auth-field">
                <span className="field-label">Nova senha</span>
                <PasswordInput
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <label className="auth-field">
                <span className="field-label">Confirmar nova senha</span>
                <PasswordInput
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  autoComplete="new-password"
                />
              </label>

              {error && <div className="auth-msg err">{error}</div>}

              <button type="submit" className="auth-submit" disabled={busy}>
                {busy ? 'Salvando…' : 'Salvar nova senha'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
