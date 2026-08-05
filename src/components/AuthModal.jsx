import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { trackMetaEvent } from '../lib/metaPixel.js';
import PasswordInput from './PasswordInput.jsx';
import PasswordChecklist from './PasswordChecklist.jsx';
import { isStrongPassword } from '../password.js';

// O "G" oficial do Google. As diretrizes de marca deles exigem o logo original,
// nas quatro cores e sem alterações, em qualquer botão de "entrar com Google".
function GoogleG() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.71a5.4 5.4 0 0 1 0-3.44V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.17 6.66 3.58 9 3.58z" />
    </svg>
  );
}

// Login/cadastro como popup sobre a landing (mesmo backdrop desfocado do pagamento).
// `initialMode` define se abre em 'login' ou 'signup'. Com `dismissible: false`
// vira tela obrigatória (app nativo): sem × e sem fechar clicando fora.
export default function AuthModal({ open, onClose, initialMode = 'login', dismissible = true }) {
  const { signIn, signUp, resetPassword, signInWithGoogle, oauthError } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Código de quem indicou: preenchido sozinho quando o cadastro veio de um
  // link ?ref=CODIGO (guardado pelo App.jsx); no app instalado, digita à mão.
  const [ref, setRef] = useState(() => localStorage.getItem('dinprev_ref') || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isSignup = mode === 'signup';

  // Ao (re)abrir, alinha o modo ao solicitado e limpa mensagens antigas.
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError('');
      setNotice('');
    }
  }, [open, initialMode]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!email || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    // Só no cadastro: quem já tem conta pode ter uma senha de antes desta
    // regra existir, e login não é o momento de barrar por isso.
    if (isSignup && !isStrongPassword(password)) {
      setError('A senha ainda não atende aos requisitos abaixo.');
      return;
    }
    setBusy(true);
    const { data, error } = isSignup
      ? await signUp(email, password, ref.trim().toUpperCase() || null)
      : await signIn(email, password);
    setBusy(false);

    if (error) {
      setError(traduzErro(error.message));
      return;
    }
    // Cadastro confirmado com sucesso no Supabase — conversão de registro.
    if (isSignup) {
      trackMetaEvent('CompleteRegistration');
    }
    // Se a confirmação por e-mail estiver ligada, não há sessão imediata no cadastro.
    if (isSignup && !data.session) {
      setNotice('Conta criada! Confira seu e-mail para confirmar o acesso.');
    }
  };

  // Entrar com o Google. No navegador esta chamada leva a página embora (o
  // Supabase redireciona), então o `busy` só é desfeito em caso de erro.
  const google = async () => {
    setError('');
    setNotice('');
    setBusy(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setBusy(false);
      setError('Não foi possível abrir o login do Google. Tente novamente.');
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

  if (!open) return null;

  return (
    <div className="pay-modal-backdrop" onClick={dismissible ? onClose : undefined}>
      <div className="pay-modal" onClick={(e) => e.stopPropagation()}>
        {dismissible && (
          <button type="button" className="pay-modal-close" onClick={onClose} aria-label="Fechar">×</button>
        )}
        <div className="auth-card" style={{ maxWidth: '100%' }}>
          <div className="auth-brand">
            <span className="logo"><img src="/logo.png" alt="DinPrev" /></span>
            <div>
              <div className="brand-name">DinPrev</div>
              <div className="brand-sub">Finanças pessoais</div>
            </div>
          </div>

          <h2 className="auth-title">{isSignup ? 'Criar conta' : 'Entrar'}</h2>
          <p className="auth-lead">
            {isSignup
              ? 'Cadastre-se para salvar seus dados na nuvem.'
              : 'Acesse sua conta para ver seu planejamento.'}
          </p>

          {/* Caminho de menos atrito primeiro: um toque, sem senha para criar
              nem lembrar. O formulário de e-mail continua logo abaixo. */}
          <button type="button" className="auth-google" onClick={google} disabled={busy}>
            <GoogleG />
            {isSignup ? 'Criar conta com o Google' : 'Continuar com o Google'}
          </button>

          {oauthError && <div className="auth-msg err">{oauthError}</div>}

          <div className="auth-sep"><span>ou com e-mail</span></div>

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
            {isSignup && (
              <label className="auth-field">
                <span className="field-label">Código de indicação (opcional)</span>
                <input
                  type="text"
                  className="auth-input"
                  value={ref}
                  onChange={(e) => setRef(e.target.value.toUpperCase())}
                  placeholder="Ex.: A7K2MP9Q"
                  autoComplete="off"
                  maxLength={12}
                  style={{ textTransform: 'uppercase' }}
                />
              </label>
            )}
            <label className="auth-field">
              <span className="field-label">Senha</span>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
              />
            </label>
            {isSignup && <PasswordChecklist password={password} />}

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
