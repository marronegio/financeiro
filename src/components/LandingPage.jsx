import React, { useEffect, useState } from 'react';
import '../landing.css';
import LandingDemo, { PlanMock, AiChatMock } from './LandingDemo.jsx';
import PaywallModal from './PaywallModal.jsx';
import AuthModal from './AuthModal.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  PLANS, planKey, planPerks, normalizePlanKey,
  FREE_PLAN, FREE_PERKS, FREE_MISSING,
} from '../plans.js';
import { trackMetaEvent } from '../lib/metaPixel.js';

// Listagem do app na Play Store (o app Android é este mesmo produto,
// empacotado com Capacitor — ver MOBILE.md).
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.dinprev.app';

// Selo que leva à Play Store. O ícone é um "play" neutro, e não a marca colorida
// do Google: o logo deles só pode ser usado dentro do badge oficial, inteiro e
// sem modificações. Para trocar pelo badge oficial, baixe o PNG na página de
// marca do Google Play, jogue em public/ e troque isto por um <img>.
function PlayBadge({ className = '' }) {
  return (
    <a
      className={'lp-store' + (className ? ` ${className}` : '')}
      href={PLAY_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="lp-store-ico" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor">
          <path d="M5 2.5v19l16.5-9.5z" />
        </svg>
      </span>
      <span className="lp-store-txt">
        <span className="lp-store-top">Baixe para Android</span>
        <span className="lp-store-name">Google Play</span>
      </span>
    </a>
  );
}

// Card de preço de um plano (Solo/Duo × Mensal/Anual).
// Exportado para o MobileGate (seleção de plano no app nativo).
export function PriceCard({ planId, onStart }) {
  const plan = PLANS[planId];
  const isDuo = plan.tier === 'duo';
  return (
    <div className={'lp-price-card' + (isDuo ? ' lp-price-card-duo' : '')}>
      {plan.badge && <div className="lp-price-badge">{plan.badge}</div>}
      <div className="lp-price-label">{plan.label}</div>
      <div className="lp-price-value">
        <span className="lp-price-currency">R$</span>
        <span className="lp-price-amount">{plan.amount}</span>
        {plan.cents && <span className="lp-price-cents">{plan.cents}</span>}
      </div>
      <div className="lp-price-period">{plan.period}</div>
      {plan.economy && <div className="lp-price-economy">{plan.economy}</div>}
      <ul className="lp-price-perks">
        {planPerks(plan.tier, plan.cycle).map((perk) => (
          <li key={perk.text} className={perk.special ? 'lp-perk-special' : ''}>
            {perk.text}
          </li>
        ))}
      </ul>
      <button className="lp-cta-price" onClick={() => onStart(planId)}>
        Assinar agora
      </button>
      <p className="lp-price-note">{plan.note}</p>
    </div>
  );
}

// Card do plano grátis (só existe no Solo). Mesma estrutura do PriceCard para
// ficar lado a lado com os pagos; só o botão é vazado, para "Assinar agora" não
// disputar atenção com três CTAs sólidos iguais.
export function FreePlanCard({ onStart }) {
  return (
    <div className="lp-price-card lp-price-card-free">
      <div className="lp-price-label">{FREE_PLAN.label}</div>
      <div className="lp-price-value">
        <span className="lp-price-currency">R$</span>
        <span className="lp-price-amount">{FREE_PLAN.amount}</span>
      </div>
      <div className="lp-price-period">{FREE_PLAN.period}</div>
      <ul className="lp-price-perks">
        {FREE_PERKS.map((perk) => <li key={perk}>{perk}</li>)}
      </ul>
      <ul className="lp-free-missing">
        {FREE_MISSING.map((item) => <li key={item}>{item}</li>)}
      </ul>
      <button className="lp-cta-price lp-cta-free" onClick={onStart}>
        Começar grátis
      </button>
      <p className="lp-price-note">{FREE_PLAN.note}</p>
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

export default function LandingPage({ authed = false, paywall = false, paymentResult = null }) {
  useReveal();
  const { signOut } = useAuth();
  // Aba da seção de preços: sozinho (Solo) ou a dois (Duo). Cada aba mostra o
  // par Mensal + Anual do tier.
  const [tier, setTier] = useState('solo');

  // Popup de pagamento: aberto automaticamente quando o usuário já está logado mas
  // sem assinatura ativa (ou voltando do checkout do cartão).
  const [paywallOpen, setPaywallOpen] = useState(paywall || paymentResult === 'success');
  const [selectedPlan, setSelectedPlan] = useState(
    normalizePlanKey(localStorage.getItem('dinprev_plan'))
  );
  // Popup de login/cadastro (só para visitantes não logados).
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  const openAuth = (mode) => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  // Escolher um plano: guarda a escolha. Se já logado, abre o popup de pagamento;
  // senão, abre o cadastro (o plano fica salvo pra depois do login).
  const start = (planId) => {
    localStorage.setItem('dinprev_plan', planId);
    setSelectedPlan(planId);
    trackMetaEvent('Lead');
    if (authed) setPaywallOpen(true);
    else openAuth('signup');
  };

  // Começar no grátis: não guarda plano nenhum — se guardasse, o paywall
  // reabriria depois com um plano pago pré-selecionado.
  const startFree = () => {
    localStorage.removeItem('dinprev_plan');
    trackMetaEvent('Lead');
    if (authed) window.location.href = '/';
    else openAuth('signup');
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
          <button className="lp-nav-link" onClick={() => scrollTo('ia')}>Assistente IA</button>
          <button className="lp-nav-link" onClick={() => scrollTo('como-funciona')}>Como funciona</button>
          <button className="lp-nav-link" onClick={() => scrollTo('preco')}>Preço</button>
        </div>
        <div className="lp-nav-actions">
          {authed ? (
            <>
              <button className="lp-btn-ghost" onClick={signOut}>Sair</button>
              <button className="lp-btn-primary" onClick={() => setPaywallOpen(true)}>Concluir assinatura</button>
            </>
          ) : (
            <>
              <button className="lp-btn-ghost" onClick={() => openAuth('login')}>Entrar</button>
              <button className="lp-btn-primary" onClick={() => scrollTo('preco')}>Começar</button>
            </>
          )}
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
            O DinPrev distribui seu salário antes de você gastar e ainda tem um
            assistente com IA que lança seus gastos por texto, áudio ou foto.
            Quando o cartão fecha, não tem mais surpresa — você já sabia o número
            desde o começo do mês.
          </p>

          <div className="lp-hero-ctas">
            <button className="lp-cta-main" onClick={() => scrollTo('preco')}>
              Começar agora
            </button>
            <button className="lp-cta-sec" onClick={() => scrollTo('como-funciona')}>
              Ver como funciona ↓
            </button>
          </div>

          <p className="lp-hero-footnote">
            <strong className="lp-trial-pill">A partir de R$17,90/mês</strong>
            cartão de crédito ou PIX · cancele quando quiser
          </p>

          <div className="lp-hero-store">
            <PlayBadge />
          </div>
        </div>

        <div className="lp-hero-right">
          <div className="lp-hero-card">
            <PlanMock />
          </div>
        </div>
      </section>

      {/* ── strip ── */}
      <div className="lp-strip">
        <span className="lp-strip-item lp-strip-trial">✦ Cartão ou PIX</span>
        <span className="lp-strip-item">🤖 Assistente com IA</span>
        <span className="lp-strip-item">☁ Dados na nuvem</span>
        <span className="lp-strip-item">📱 Android e web desktop</span>
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
            planejamento ao histórico, e o assistente de IA que lança tudo por você. Tudo
            conversa entre si.
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
              Cada painel resolve uma parte do quebra-cabeça. Juntos, mostram exatamente onde
              está cada real do seu salário — e o assistente de IA preenche tudo pra você.
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

      {/* ── AI assistant ── */}
      <section className="lp-ai-section" id="ia">
        <div className="lp-ai-inner">
          <div className="lp-ai-text">
            <div className="lp-tag reveal">Assistente com IA</div>
            <h2 className="reveal reveal-delay-1">
              Converse com o seu dinheiro.<br /><em>Ele lança por você.</em>
            </h2>
            <p className="reveal reveal-delay-2">
              Esqueça formulários. Fale, escreva ou mande uma foto — o assistente entende,
              lança no painel certo e ainda te dá o retrato do mês na hora. É como ter um
              parceiro financeiro no bolso, 24 horas por dia.
            </p>
            <ul className="lp-ai-caps reveal reveal-delay-3">
              <li>
                <span className="lp-ai-cap-ico">💬</span>
                <span><b>Texto</b> — "gastei 45 no mercado" e pronto, já entrou na fatura.</span>
              </li>
              <li>
                <span className="lp-ai-cap-ico">🎙️</span>
                <span><b>Áudio</b> — mande um recado de voz, tipo no WhatsApp, e ele transcreve e lança.</span>
              </li>
              <li>
                <span className="lp-ai-cap-ico">📷</span>
                <span><b>Imagem</b> — fotografe um comprovante, boleto ou nota fiscal e ele registra sozinho.</span>
              </li>
            </ul>
            <button className="lp-cta-main reveal reveal-delay-4" onClick={() => scrollTo('preco')}>
              Começar agora
            </button>
          </div>
          <div className="lp-ai-demo reveal reveal-delay-2">
            <AiChatMock />
          </div>
        </div>
      </section>

      {/* ── reminders ── */}
      <section className="lp-remind" id="lembretes">
        <div className="lp-remind-inner">
          <div className="lp-remind-visual reveal">
            <div className="lp-remind-stack">
              <div className="lp-toast reveal reveal-delay-1">
                <span className="lp-toast-ico">🔔</span>
                <div className="lp-toast-body">
                  <div className="lp-toast-title">“Energia” vence amanhã</div>
                  <div className="lp-toast-sub">R$ 189,90 · vencimento dia 10</div>
                </div>
                <span className="lp-toast-btn">Já paguei</span>
              </div>

              <div className="lp-toast reveal reveal-delay-2">
                <span className="lp-toast-ico">🔔</span>
                <div className="lp-toast-body">
                  <div className="lp-toast-title">“Internet” vence em 3 dias</div>
                  <div className="lp-toast-sub">R$ 119,90 · vencimento dia 15</div>
                </div>
                <span className="lp-toast-btn">Já paguei</span>
              </div>

              <div className="lp-email reveal reveal-delay-3">
                <div className="lp-email-head">
                  <span className="lp-email-avatar">D</span>
                  <div>
                    <div className="lp-email-from">DinPrev</div>
                    <div className="lp-email-meta">para você · agora</div>
                  </div>
                  <span className="lp-email-tag">✉ E-mail</span>
                </div>
                <div className="lp-email-body">
                  <div className="lp-email-subject">🔔 Sua despesa “Aluguel” vence amanhã</div>
                  <p className="lp-email-text">
                    Oi! Passando pra lembrar: <b>Aluguel</b> (R$ 1.450,00) vence amanhã, dia 05.
                    Deixe pago em dia e evite juros. 👋
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lp-remind-text">
            <div className="lp-tag reveal">Lembretes</div>
            <h2 className="reveal reveal-delay-1">
              As contas não te pegam<br /><em>de surpresa</em>.
            </h2>
            <p className="reveal reveal-delay-2">
              O DinPrev acompanha o vencimento de cada despesa fixa e te avisa antes — dentro do
              app e por e-mail. Você marca como paga num toque e nunca mais perde uma data (nem
              paga juros à toa).
            </p>
            <ul className="lp-remind-list reveal reveal-delay-3">
              <li>
                <span className="lp-remind-ico">🔔</span>
                <span><b>Avisos dentro do app</b> — um alerta aparece assim que a data se aproxima.</span>
              </li>
              <li>
                <span className="lp-remind-ico">📧</span>
                <span><b>E-mail um dia antes</b> — o clássico “vence amanhã” chega na sua caixa de entrada.</span>
              </li>
              <li>
                <span className="lp-remind-ico">✅</span>
                <span><b>Marque como paga</b> — um toque e o lembrete some até o próximo mês.</span>
              </li>
            </ul>
            <button className="lp-cta-main reveal reveal-delay-4" onClick={() => scrollTo('preco')}>
              Começar agora
            </button>
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
              { n: '02', title: 'Veja quanto sobra', desc: 'O painel mostra em tempo real o saldo disponível. Adicione um gasto — digitando ou pedindo pro assistente — e o número atualiza na hora.' },
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
          Menos que um jantar.<br />
          <em>Todo mês no controle.</em>
        </h2>
        <p className="lp-pricing-sub reveal reveal-delay-2">
          Escolha o plano ideal — sozinho ou a dois. Pague no cartão de crédito ou PIX. Cancele quando quiser.
        </p>

        <div className="lp-tier-toggle reveal reveal-delay-2" role="tablist" aria-label="Tipo de plano">
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

        {/* O grátis é exclusivo do Solo — na aba Duo a grade volta a ter dois
            cards. O "são três" vai num data-attribute, e não no className, de
            propósito: o useReveal adiciona a classe `visible` direto no DOM e
            depois faz unobserve. Se o className fosse dinâmico, alternar
            Solo/Duo faria o React reescrever o atributo, apagando o `visible` —
            e a grade sumiria de vez (fica em opacity: 0, sem observer para
            trazê-la de volta). */}
        <div
          className="lp-price-cards reveal reveal-delay-3"
          data-cards={tier === 'solo' ? '3' : '2'}
        >
          {tier === 'solo' && <FreePlanCard onStart={startFree} />}
          <PriceCard planId={planKey(tier, 'monthly')} onStart={start} />
          <PriceCard planId={planKey(tier, 'annual')} onStart={start} />
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
          Comece agora — a partir de R$17,90/mês.
        </p>
        <button className="lp-cta-final reveal reveal-delay-2" onClick={() => scrollTo('preco')}>
          Começar agora
        </button>
        <p className="lp-final-note reveal reveal-delay-3">A partir de R$17,90/mês · cartão ou PIX · cancele quando quiser</p>
      </section>

      {/* ── footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer-brand">
          <div className="lp-logo"><img src="/logo.png" alt="DinPrev" /></div>
          <span style={{ color: '#cfd7e3', fontSize: 15, fontWeight: 600 }}>DinPrev</span>
        </div>
        <PlayBadge className="lp-store-navy" />
        <span className="lp-footer-copy">© {new Date().getFullYear()} DinPrev. Todos os direitos reservados.</span>
      </footer>

      <AuthModal
        open={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
      />

      <PaywallModal
        open={paywallOpen}
        planId={selectedPlan}
        paymentResult={paymentResult}
        onClose={() => setPaywallOpen(false)}
        onChangePlan={() => { setPaywallOpen(false); scrollTo('preco'); }}
      />

    </div>
  );
}
