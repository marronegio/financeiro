import React, { useEffect, useState } from 'react';
import '../landing.css';
import LandingDemo, { PlanMock } from './LandingDemo.jsx';
import { PLANS, planKey, planPerks } from '../plans.js';

// Card de preço de um plano (Solo ou Duo) para o ciclo selecionado.
function PriceCard({ planId, onStart }) {
  const plan = PLANS[planId];
  const isDuo = plan.tier === 'duo';
  return (
    <div className={'lp-price-card' + (isDuo ? ' lp-price-card-duo' : '')}>
      <div className="lp-price-badge">{isDuo ? 'Ideal para casais' : '7 dias grátis'}</div>
      <div className="lp-price-label">{isDuo ? 'Duo · 2 perfis' : 'Solo'}</div>
      <div className="lp-price-value">
        <span className="lp-price-currency">R$</span>
        <span className="lp-price-amount">{plan.amount}</span>
        {plan.cents && <span className="lp-price-cents">{plan.cents}</span>}
      </div>
      <div className="lp-price-period">{plan.period}</div>
      {plan.economy && <div className="lp-price-economy">{plan.economy}</div>}
      <ul className="lp-price-perks">
        {planPerks(plan.tier).map((perk) => (
          <li key={perk}>{perk}</li>
        ))}
      </ul>
      <button className="lp-cta-price" onClick={() => onStart(planId)}>
        Começar 7 dias grátis
      </button>
      <p className="lp-price-note">{plan.note}</p>
    </div>
  );
}

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } }),
      { threshold: 0.12 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

export default function LandingPage({ onGetStarted, onLogin }) {
  useReveal();
  const [billing, setBilling] = useState('annual');
  const annual = billing === 'annual';

  // Guarda o plano escolhido para a edge function de checkout ler depois do cadastro.
  const start = (planId) => {
    localStorage.setItem('dinprev_plan', planId);
    onGetStarted();
  };

  const scrollTo = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="lp">

      {/* ── nav ── */}
      <nav className="lp-nav">
        <div className="lp-nav-brand">
          <div className="lp-logo"><img src="/logo.png" alt="DinPrev" /></div>
          <span className="lp-brand-name">DinPrev</span>
        </div>
        <div className="lp-nav-links">
          <button className="lp-nav-link" onClick={() => scrollTo('recursos')}>Recursos</button>
          <button className="lp-nav-link" onClick={() => scrollTo('como-funciona')}>Como funciona</button>
          <button className="lp-nav-link" onClick={() => scrollTo('preco')}>Preço</button>
        </div>
        <div className="lp-nav-actions">
          <button className="lp-btn-ghost" onClick={onLogin}>Entrar</button>
          <button className="lp-btn-primary" onClick={() => scrollTo('preco')}>Começar</button>
        </div>
      </nav>

      {/* ── hero ── */}
      <section className="lp-hero">
        <div className="lp-hero-orb lp-hero-orb-1" />
        <div className="lp-hero-orb lp-hero-orb-2" />
        <div className="lp-hero-orb lp-hero-orb-3" />

        <div className="lp-hero-left">
          <div className="lp-hero-eyebrow">
            <span className="lp-hero-eyebrow-dot" />
            Gestão financeira pessoal
          </div>

          <h1>
            Você não ganha pouco.
            <span className="h1-line-2">Só não sabe<br />para onde vai.</span>
          </h1>

          <p className="lp-hero-sub">
            O DinPrev distribui seu salário antes de você gastar.
            Quando o cartão fecha, não tem mais surpresa —
            porque você já sabia o número desde o início do mês.
          </p>

          <div className="lp-hero-ctas">
            <button className="lp-cta-main" onClick={() => scrollTo('preco')}>
              Começar 7 dias grátis
            </button>
            <button className="lp-cta-sec" onClick={() => scrollTo('como-funciona')}>
              Ver como funciona ↓
            </button>
          </div>

          <p className="lp-hero-footnote">
            <strong className="lp-trial-pill">7 dias grátis</strong>
            depois a partir de R$19,90/mês · cancele quando quiser
          </p>
        </div>

        <div className="lp-hero-right">
          <div className="lp-hero-card">
            <PlanMock />
          </div>
        </div>
      </section>

      {/* ── strip ── */}
      <div className="lp-strip">
        <span className="lp-strip-item lp-strip-trial">✦ 7 dias grátis</span>
        <span className="lp-strip-item">☁ Dados na nuvem</span>
        <span className="lp-strip-item">📱 Celular e desktop</span>
        <span className="lp-strip-item">🔒 Só você acessa</span>
        <span className="lp-strip-item">⚡ Sem planilhas</span>
      </div>

      {/* ── showcase: app por dentro ── */}
      <section className="lp-showcase" id="demo">
        <div className="lp-showcase-head">
          <div className="lp-tag reveal">Por dentro</div>
          <h2 className="reveal reveal-delay-1">
            Veja como o <em>DinPrev</em> funciona.
          </h2>
          <p className="reveal reveal-delay-2">
            São os painéis reais do app. Passe pelas abas e veja os números se ajustando — do
            planejamento ao histórico, tudo conversa entre si.
          </p>
        </div>
        <LandingDemo />
      </section>

      {/* ── problem ── */}
      <section style={{ background: '#ffffff' }}>
        <div className="lp-problem">
          <div className="lp-problem-grid">
            <div>
              <h2 className="reveal reveal-delay-1">
                O cartão não é o vilão.<br />
                É o <em>sintoma</em>.
              </h2>
              <div className="lp-problem-text reveal reveal-delay-2">
                <p>
                  Você usa o crédito porque não sabe quanto sobra.
                  E não sabe quanto sobra porque nunca parou pra distribuir
                  o salário antes de gastar.
                </p>
                <p>
                  Não é falta de disciplina. É falta de visibilidade.
                  Quando você enxerga os números antes de gastar,
                  as escolhas mudam sozinhas.
                </p>
              </div>
            </div>
            <div className="lp-pains">
              <div className="lp-pain reveal reveal-delay-1">
                <span className="lp-pain-ico">😬</span>
                <div>
                  <h3>A fatura chega e você não sabia o valor</h3>
                  <p>Compras pequenas ao longo do mês que somam mais do que pareciam.</p>
                </div>
              </div>
              <div className="lp-pain reveal reveal-delay-2">
                <span className="lp-pain-ico">🔁</span>
                <div>
                  <h3>Parcelas novas em cima de parcelas antigas</h3>
                  <p>Cada mês fecha um parcelamento novo sem o antigo ter acabado. O compromisso não cai.</p>
                </div>
              </div>
              <div className="lp-pain reveal reveal-delay-3">
                <span className="lp-pain-ico">📆</span>
                <div>
                  <h3>"Esse mês eu guardo" — de novo</h3>
                  <p>Sem controle prévio, não sobra nada pra reserva. A meta fica sempre pro mês que vem.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── features ── */}
      <section className="lp-features" id="recursos">
        <div className="lp-features-inner">
          <div className="lp-features-head">
            <div className="lp-tag reveal">O que você tem</div>
            <h2 className="reveal reveal-delay-1">
              Seis painéis.<br />Um <em>panorama completo</em>.
            </h2>
            <p className="reveal reveal-delay-2">
              Cada painel resolve uma parte do quebra-cabeça. Juntos, eles mostram exatamente onde está cada real do seu salário.
            </p>
          </div>
          <div className="lp-feats">
            {[
              { ico: '💰', title: 'Planejamento', desc: 'Defina o salário e veja em tempo real quanto sobra depois de cada tipo de gasto.' },
              { ico: '🏠', title: 'Despesas fixas', desc: 'Aluguel, energia, internet, escola — tudo que sai todo mês, sem esquecer nada.' },
              { ico: '🎬', title: 'Assinaturas', desc: 'Streaming, academia, apps. Veja o total que debita automático e decida o que vale manter.' },
              { ico: '💳', title: 'Cartão de crédito', desc: 'Saiba exatamente quanto ainda cabe na fatura antes de o mês fechar.' },
              { ico: '📦', title: 'Parcelamentos', desc: 'Acompanhe cada compra parcelada, a parcela do mês e quanto falta pra quitar.' },
              { ico: '📊', title: 'Histórico', desc: 'Compare mês a mês. Veja se você está realmente guardando mais do que antes.' },
            ].map((f, i) => (
              <div key={f.title} className={`lp-feat reveal reveal-delay-${i + 1}`}>
                <div className="lp-feat-ico">{f.ico}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── how it works ── */}
      <section className="lp-how" id="como-funciona">
        <div className="lp-how-inner">
          <div className="lp-how-text">
            <div className="lp-tag reveal">Como funciona</div>
            <h2 className="reveal reveal-delay-1">
              Uma vez por mês.<br />Cinco minutos.<br /><em>O resto se resolve.</em>
            </h2>
            <p className="reveal reveal-delay-2">
              O DinPrev não exige que você registre cada compra. Você só precisa configurar o cenário do mês — o resto é acompanhamento.
            </p>
          </div>
          <div className="lp-steps">
            {[
              { n: '01', title: 'Configure o mês', desc: 'Insira salário, despesas fixas, assinaturas e o limite que quer gastar no cartão. Leva menos de cinco minutos.' },
              { n: '02', title: 'Veja quanto sobra', desc: 'O painel mostra em tempo real o saldo disponível. Quando você adiciona uma compra, o número atualiza na hora.' },
              { n: '03', title: 'Feche o mês e repita', desc: 'No encerramento, registre quanto conseguiu guardar. O histórico vai mostrar sua evolução ao longo do tempo.' },
            ].map((s, i) => (
              <div key={s.n} className={`lp-step reveal reveal-delay-${i + 1}`}>
                <div className="lp-step-num">{s.n}</div>
                <div className="lp-step-body">
                  <h4>{s.title}</h4>
                  <p>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── pricing ── */}
      <section className="lp-pricing" id="preco">
        <h2 className="reveal reveal-delay-1">
          Experimente <em>7 dias grátis</em>.<br />
          Depois, menos que um jantar.
        </h2>
        <p className="lp-pricing-sub reveal reveal-delay-2">
          Teste tudo sem pagar nada. Passados os 7 dias, escolha o plano ideal — sozinho ou a dois. Cancele quando quiser.
        </p>

        <div className="lp-billing-toggle reveal reveal-delay-2" role="tablist" aria-label="Período de cobrança">
          <button
            type="button"
            role="tab"
            aria-selected={!annual}
            className={!annual ? 'active' : ''}
            onClick={() => setBilling('monthly')}
          >
            Mensal
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={annual}
            className={annual ? 'active' : ''}
            onClick={() => setBilling('annual')}
          >
            Anual <span className="lp-billing-save">economize</span>
          </button>
        </div>

        <div className="lp-price-cards reveal reveal-delay-3">
          <PriceCard planId={planKey('solo', billing)} onStart={start} />
          <PriceCard planId={planKey('duo', billing)} onStart={start} />
        </div>
      </section>

      {/* ── final cta ── */}
      <section className="lp-final">
        <h2 className="reveal">
          Chega de terminar o mês<br />
          <em>sem saber o que aconteceu</em>.
        </h2>
        <p className="reveal reveal-delay-1">
          Em menos de cinco minutos você já tem o panorama completo.
          Experimente 7 dias grátis — sem cobrança hoje.
        </p>
        <button className="lp-cta-final reveal reveal-delay-2" onClick={() => scrollTo('preco')}>
          Começar 7 dias grátis
        </button>
        <p className="lp-final-note reveal reveal-delay-3">Depois a partir de R$19,90/mês · cancele quando quiser</p>
      </section>

      {/* ── footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer-brand">
          <div className="lp-logo"><img src="/logo.png" alt="DinPrev" /></div>
          <span style={{ color: '#cfd7e3', fontSize: 15, fontWeight: 600 }}>DinPrev</span>
        </div>
        <span className="lp-footer-copy">© {new Date().getFullYear()} DinPrev. Todos os direitos reservados.</span>
      </footer>

    </div>
  );
}
