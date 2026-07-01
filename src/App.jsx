import React from 'react';
import { useAuth } from './auth/AuthContext.jsx';
import { useSubscription } from './hooks/useSubscription.js';
import Dashboard from './Dashboard.jsx';
import LandingPage from './components/LandingPage.jsx';
import ResetPasswordScreen from './components/ResetPasswordScreen.jsx';

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
  const { status: subStatus, plan, trialing, provider } = useSubscription(user);

  // Lê resultado do redirect do gateway (?payment=success|cancel)
  const params = new URLSearchParams(window.location.search);
  const paymentResult = params.get('payment'); // 'success' | 'cancel' | null

  if (loading) return <Spinner />;

  // Recuperação de senha (link do e-mail) tem prioridade sobre tudo.
  if (recovery) return <ResetPasswordScreen />;

  // Não logado: a landing gerencia o popup de login/cadastro internamente.
  if (!user) {
    return <LandingPage />;
  }

  // Logado — aguarda verificação de assinatura
  if (subStatus === 'loading') return <Spinner label="Verificando assinatura…" />;

  // Logado — sem assinatura ativa: mostra a landing com o popup de pagamento por cima
  // (a landing fica desfocada/escurecida atrás). O plano vem escolhido da landing.
  if (subStatus !== 'active') {
    return <LandingPage authed paywall paymentResult={paymentResult} />;
  }

  // Logado + assinatura ativa
  return <Dashboard plan={plan} trialing={trialing} provider={provider} />;
}
