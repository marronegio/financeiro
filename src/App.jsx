import React, { useEffect } from 'react';
import { useAuth } from './auth/AuthContext.jsx';
import { useSubscription } from './hooks/useSubscription.js';
import { applyTheme, storedTheme } from './theme.js';
import Dashboard from './Dashboard.jsx';
import LandingPage from './components/LandingPage.jsx';
import MobileGate from './components/MobileGate.jsx';
import ResetPasswordScreen from './components/ResetPasswordScreen.jsx';
import { isNativeApp } from './lib/native.js';

function Spinner({ label = 'Carregando…' }) {
  return (
    <div className="app">
      <div className="loading-screen">
        <div className="spinner" />
        <p>{label}</p>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading, recovery } = useAuth();
  const { status: subStatus, plan, tier, trialing, provider, aiEnabled } = useSubscription(user);

  // Lê resultado do redirect do gateway (?payment=success|cancel)
  const params = new URLSearchParams(window.location.search);
  const paymentResult = params.get('payment'); // 'success' | 'cancel' | null

  // Link de indicação (?ref=CODIGO): guarda para o cadastro preencher sozinho.
  const refCode = params.get('ref');
  if (refCode) localStorage.setItem('dinprev_ref', refCode.toUpperCase());

  // O tema escuro salvo só vale dentro do dashboard; landing e telas de auth
  // ficam sempre claras. Enquanto auth/assinatura carregam, não decide (evita
  // flash contra o palpite do script inline do index.html).
  const themeReady = !loading && (!user || subStatus !== 'loading');
  const isDashboard = themeReady && !recovery && !!user;
  useEffect(() => {
    if (!themeReady) return;
    applyTheme(isDashboard ? storedTheme() : 'light');
  }, [themeReady, isDashboard]);

  if (loading) return <Spinner />;

  // Recuperação de senha (link do e-mail) tem prioridade sobre tudo.
  if (recovery) return <ResetPasswordScreen />;

  // Não logado. No site, a landing gerencia o popup de login/cadastro; no app
  // nativo não há landing — cadastro/login é a primeira tela.
  if (!user) {
    if (isNativeApp) return <MobileGate stage="auth" />;
    return <LandingPage />;
  }

  // Logado — aguarda verificação de assinatura
  if (subStatus === 'loading') return <Spinner label="Verificando assinatura…" />;

  // Logado — entra sempre. Sem assinatura ativa, o tier é 'free' e o Dashboard
  // aplica os limites (src/limits.js). O paywall deixou de ser um portão na
  // entrada e virou o caminho de upgrade, aberto de dentro do app.
  return (
    <Dashboard
      tier={tier}
      plan={plan}
      trialing={trialing}
      provider={provider}
      aiEnabled={aiEnabled}
      paymentResult={paymentResult}
    />
  );
}
