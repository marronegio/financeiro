import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

const GoogleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
  </svg>
);

export default function AuthScreen() {
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
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

  const google = async () => {
    setError('');
    setBusy(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setBusy(false);
      setError(traduzErro(error.message));
    }
    // Em caso de sucesso o navegador redireciona para o Google.
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

        <button type="button" className="google-btn" onClick={google} disabled={busy}>
          <GoogleIcon />
          Continuar com Google
        </button>

        <div className="auth-divider"><span>ou</span></div>

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
  if (m.includes('provider is not enabled'))
    return 'Login com Google não está habilitado no projeto Supabase.';
  return msg || 'Algo deu errado. Tente novamente.';
}
