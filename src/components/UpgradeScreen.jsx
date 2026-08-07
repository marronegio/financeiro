import React, { useEffect, useState } from 'react';
import '../landing.css';
import { planKey, normalizePlanKey } from '../plans.js';
import { trackMetaEvent } from '../lib/metaPixel.js';
import { UPGRADE_REASONS } from '../limits.js';
import { applyTheme, storedTheme } from '../theme.js';
import PaywallModal from './PaywallModal.jsx';
import { PriceCard } from './LandingPage.jsx';

// Tela de upgrade aberta de DENTRO do app. Desde que existe o plano grátis, o
// paywall deixou de ser o portão de entrada: quem está logado já está no app, e
// só chega aqui ao esbarrar num recurso do Pro.
//
// A escolha do plano vem ANTES do pagamento de propósito — abrir direto o popup
// de "Ative sua assinatura", sem a pessoa ter visto preço nenhum, é o que fazia
// o convite parecer cobrança.
export default function UpgradeScreen({ feature = null, paymentResult = null, onClose }) {
  const [tier, setTier] = useState('solo');
  const [selectedPlan, setSelectedPlan] = useState(
    normalizePlanKey(localStorage.getItem('dinprev_plan'))
  );
  // Voltando do checkout, pula direto para o popup, que espera o webhook ativar.
  const [payOpen, setPayOpen] = useState(paymentResult === 'success');

  // Esta tela cobre o app inteiro e reaproveita a paleta clara da landing
  // (`.lp`/`.mg`) — mas o PaywallModal usa as vars globais (--surface, --ink
  // etc.), que continuavam seguindo o tema escuro salvo do dashboard. Força
  // claro enquanto está aberta e devolve o tema do dashboard ao fechar.
  useEffect(() => {
    applyTheme('light');
    return () => applyTheme(storedTheme());
  }, []);

  const start = (planId) => {
    localStorage.setItem('dinprev_plan', planId);
    setSelectedPlan(planId);
    trackMetaEvent('Lead');
    setPayOpen(true);
  };

  return (
    <div className="lp mg upgrade-screen">
      <header className="mg-head">
        <div className="lp-nav-brand">
          <div className="lp-logo"><img src="/logo.png" alt="DinPrev" /></div>
          <span className="lp-brand-name">DinPrev</span>
        </div>
        <button className="lp-btn-ghost" onClick={onClose}>Voltar ao app</button>
      </header>

      <section className="lp-pricing mg-pricing">
        <h2>Libere tudo com o <em>Pro</em>.</h2>
        <p className="lp-pricing-sub">
          {(feature && UPGRADE_REASONS[feature]) ||
            'Assistente com IA, histórico completo e todos os painéis.'}{' '}
          Pague no cartão de crédito ou PIX. Cancele quando quiser.
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

        {/* Sem o card do Grátis: quem está aqui já está nele. */}
        <div className="lp-price-cards">
          <PriceCard planId={planKey(tier, 'monthly')} onStart={start} />
          <PriceCard planId={planKey(tier, 'annual')} onStart={start} />
        </div>
      </section>

      <PaywallModal
        open={payOpen}
        planId={selectedPlan}
        reason={feature}
        paymentResult={paymentResult}
        onClose={() => setPayOpen(false)}
        onChangePlan={() => setPayOpen(false)}
      />
    </div>
  );
}
