import React from 'react';
import { useAuth } from './auth/AuthContext.jsx';
import { useSubscription } from './hooks/useSubscription.js';
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
  const { status: subStatus, plan, trialing, provider, aiEnabled } = useSubscription(user);

  // Lê resultado do redirect do gateway (?payment=success|cancel)
  const params = new URLSearchParams(window.location.search);
  const paymentResult = params.get('payment'); // 'success' | 'cancel' | null

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

  // Logado — sem assinatura ativa. No site, landing com o popup de pagamento
  // por cima; no app nativo, tela de escolha de plano + pagamento.
  if (subStatus !== 'active') {
    if (isNativeApp) return <MobileGate stage="plans" paymentResult={paymentResult} />;
    return <LandingPage authed paywall paymentResult={paymentResult} />;
  }

  // Logado + assinatura ativa
  return <Dashboard plan={plan} trialing={trialing} provider={provider} aiEnabled={aiEnabled} />;
}
