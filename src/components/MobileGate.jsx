import React, { useEffect, useState } from 'react';
import '../landing.css';
import { App as CapApp } from '@capacitor/app';
import { useAuth } from '../auth/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';
import { planKey, normalizePlanKey } from '../plans.js';
import { trackMetaEvent } from '../lib/metaPixel.js';
import AuthModal from './AuthModal.jsx';
import PaywallModal from './PaywallModal.jsx';
import { PriceCard } from './LandingPage.jsx';

// Fluxo do app nativo (Android/iOS) — a landing é só do site. Quem instalou o
// app cai direto no cadastro/login (`stage: 'auth'`); logado sem assinatura
// escolhe o plano e paga (`stage: 'plans'`); com assinatura ativa o App.jsx
// nem chega aqui (vai direto ao Dashboard).
export default function MobileGate({ stage, paymentResult = null }) {
  const { signOut } = useAuth();
  const [tier, setTier] = useState('solo');
  const [selectedPlan, setSelectedPlan] = useState(
    normalizePlanKey(localStorage.getItem('dinprev_plan'))
  );
  // Abre direto no pagamento quando voltando do checkout com sucesso.
  const [paywallOpen, setPaywallOpen] = useState(paymentResult === 'success');

  const start = (planId) => {
    localStorage.setItem('dinprev_plan', planId);
    setSelectedPlan(planId);
    trackMetaEvent('Lead');
    setPaywallOpen(true);
  };

  // O pagamento no cartão acontece no navegador externo. Quando o usuário
  // volta pro app, conferimos se o webhook já ativou a assinatura.
  useEffect(() => {
    if (stage !== 'plans') return;
    const listener = CapApp.addListener('resume', async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('subscription_status')
        .eq('id', user.id)
        .single();
      if (data?.subscription_status === 'active') window.location.reload();
    });
    return () => {
      listener.then((h) => h.remove());
    };
  }, [stage]);

  // Visitante: cadastro/login como tela obrigatória (sem fechar).
  if (stage === 'auth') {
    return <AuthModal open initialMode="signup" dismissible={false} onClose={() => {}} />;
  }

  // Logado sem assinatura: escolha de plano + pagamento.
  return (
    <div className="lp mg">
      <header className="mg-head">
        <div className="lp-nav-brand">
          <div className="lp-logo"><img src="/logo.png" alt="DinPrev" /></div>
          <span className="lp-brand-name">DinPrev</span>
        </div>
        <button className="lp-btn-ghost" onClick={signOut}>Sair</button>
      </header>

      <section className="lp-pricing mg-pricing">
        <h2>
          Escolha seu plano e<br /><em>comece agora</em>.
        </h2>
        <p className="lp-pricing-sub">
          Sozinho ou a dois. Pague no cartão de crédito ou PIX. Cancele quando quiser.
        </p>

        <div className="lp-tier-toggle" role="tablist" aria-label="Tipo de plano">
          <button
            type="button"
            role="tab"
            aria-selected={tier === 'solo'}
            className={tier === 'solo' ? 'active' : ''}
            onClick={() => setTier('solo')}
          >
            Solo
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tier === 'duo'}
            className={tier === 'duo' ? 'active' : ''}
            onClick={() => setTier('duo')}
          >
            Duo <span className="lp-tier-pill">2 perfis</span>
          </button>
        </div>

        <div className="lp-price-cards">
          <PriceCard planId={planKey(tier, 'monthly')} onStart={start} />
          <PriceCard planId={planKey(tier, 'annual')} onStart={start} />
        </div>
      </section>

      <PaywallModal
        open={paywallOpen}
        planId={selectedPlan}
        paymentResult={paymentResult}
        onClose={() => setPaywallOpen(false)}
        onChangePlan={() => setPaywallOpen(false)}
      />
    </div>
  );
}
