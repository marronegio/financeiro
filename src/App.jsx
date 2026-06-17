import React, { useState } from 'react';
import { useAuth } from './auth/AuthContext.jsx';
import { useSubscription } from './hooks/useSubscription.js';
import AuthScreen from './components/AuthScreen.jsx';
import Dashboard from './Dashboard.jsx';
import LandingPage from './components/LandingPage.jsx';
import PaywallPage from './components/PaywallPage.jsx';
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
  const subscription = useSubscription(user);
  const [showAuth, setShowAuth] = useState(false);

  // Lê resultado do redirect do Stripe (?payment=success|cancel)
  const params = new URLSearchParams(window.location.search);
  const paymentResult = params.get('payment'); // 'success' | 'cancel' | null

  if (loading) return <Spinner />;

  // Recuperação de senha (link do e-mail) tem prioridade sobre tudo.
  if (recovery) return <ResetPasswordScreen />;

  // Não logado
  if (!user) {
    if (showAuth) return <AuthScreen />;
    return <LandingPage onGetStarted={() => setShowAuth(true)} onLogin={() => setShowAuth(true)} />;
  }

  // Logado — aguarda verificação de assinatura
  if (subscription === 'loading') return <Spinner label="Verificando assinatura…" />;

  // Logado — sem assinatura ativa (ou voltando do Stripe)
  if (subscription !== 'active') {
    return <PaywallPage paymentResult={paymentResult} />;
  }

  // Logado + assinatura ativa
  return <Dashboard />;
}
