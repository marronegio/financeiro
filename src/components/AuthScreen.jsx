import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

export default function AuthScreen() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isSignup = mode === 'signup';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!email || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    if (password.length < 6) {
      setError('A senha precisa ter ao menos 6 caracteres.');
      return;
    }
    setBusy(true);
    const { data, error } = isSignup
      ? await signUp(email, password)
      : await signIn(email, password);
    setBusy(false);

    if (error) {
      setError(traduzErro(error.message));
      return;
    }
    // Se a confirmação por e-mail estiver ligada, não há sessão imediata no cadastro.
    if (isSignup && !data.session) {
      setNotice('Conta criada! Confira seu e-mail para confirmar o acesso.');
    }
  };

  const forgot = async () => {
    setError('');
    setNotice('');
    if (!email) {
      setError('Digite seu e-mail para redefinir a senha.');
      return;
    }
    const { error } = await resetPassword(email);
    if (error) setError(traduzErro(error.message));
    else setNotice('Enviamos um link de redefinição para o seu e-mail.');
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="logo">f</span>
          <div>
            <div className="brand-name">Finanças</div>
            <div className="brand-sub">Gestão pessoal</div>
          </div>
        </div>

        <h2 className="auth-title">{isSignup ? 'Criar conta' : 'Entrar'}</h2>
        <p className="auth-lead">
          {isSignup
            ? 'Cadastre-se para salvar seus dados na nuvem.'
            : 'Acesse sua conta para ver seu planejamento.'}
        </p>

        <form onSubmit={submit} noValidate>
          <label className="auth-field">
            <span className="field-label">E-mail</span>
            <input
              type="email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              autoComplete="email"
            />
          </label>
          <label className="auth-field">
            <span className="field-label">Senha</span>
            <input
              type="password"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
          </label>

          {!isSignup && (
            <button type="button" className="auth-link forgot" onClick={forgot} disabled={busy}>
              Esqueci a senha
            </button>
          )}

          {error && <div className="auth-msg err">{error}</div>}
          {notice && <div className="auth-msg ok">{notice}</div>}

          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? 'Aguarde…' : isSignup ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        <p className="auth-switch">
          {isSignup ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
          <button
            type="button"
            className="auth-link"
            onClick={() => {
              setMode(isSignup ? 'login' : 'signup');
              setError('');
              setNotice('');
            }}
          >
            {isSignup ? 'Entrar' : 'Criar agora'}
          </button>
        </p>
      </div>
    </div>
  );
}

// Mensagens da API do Supabase vêm em inglês; traduz as mais comuns.
function traduzErro(msg = '') {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Este e-mail já está cadastrado.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (m.includes('rate limit')) return 'Muitas tentativas. Tente novamente em instantes.';
  return msg || 'Algo deu errado. Tente novamente.';
}
