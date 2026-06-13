import React, { useEffect, useRef } from 'react';
import '../landing.css';

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

  const scrollTo = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="lp">

      {/* ── nav ── */}
      <nav className="lp-nav">
        <div className="lp-nav-brand">
          <div className="lp-logo">F</div>
          <span className="lp-brand-name">Folium</span>
        </div>
        <div className="lp-nav-links">
          <button className="lp-nav-link" onClick={() => scrollTo('recursos')}>Recursos</button>
          <button className="lp-nav-link" onClick={() => scrollTo('como-funciona')}>Como funciona</button>
          <button className="lp-nav-link" onClick={() => scrollTo('preco')}>Preço</button>
        </div>
        <div className="lp-nav-actions">
          <button className="lp-btn-ghost" onClick={onLogin}>Entrar</button>
          <button className="lp-btn-primary" onClick={onGetStarted}>Começar</button>
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
            O Folium distribui seu salário antes de você gastar.
            Quando o cartão fecha, não tem mais surpresa —
            porque você já sabia o número desde o início do mês.
          </p>

          <div className="lp-hero-ctas">
            <button className="lp-cta-main" onClick={onGetStarted}>
              Começar 7 dias grátis
            </button>
            <button className="lp-cta-sec" onClick={() => scrollTo('como-funciona')}>
              Ver como funciona ↓
            </button>
          </div>

          <p className="lp-hero-footnote">
            <strong className="lp-trial-pill">7 dias grátis</strong>
            depois R$27/mês · cancele quando quiser
          </p>
        </div>

        <div className="lp-hero-right">
          <div className="lp-preview">
            <div className="lp-preview-header">
              <span className="lp-preview-title">Planejamento</span>
              <span className="lp-preview-month">Jun 2026</span>
            </div>
            <div className="lp-preview-rows">
              <div className="lp-preview-row">
                <span className="lp-preview-row-label">
                  <span className="lp-preview-row-dot" style={{ background: '#4fd1a5' }} />
                  Salário
                </span>
                <span className="lp-preview-row-val">R$ 4.500</span>
              </div>
              <div className="lp-preview-row">
                <span className="lp-preview-row-label">
                  <span className="lp-preview-row-dot" style={{ background: '#c2553e' }} />
                  Despesas fixas
                </span>
                <span className="lp-preview-row-val">− R$ 1.840</span>
              </div>
              <div className="lp-preview-row">
                <span className="lp-preview-row-label">
                  <span className="lp-preview-row-dot" style={{ background: '#b6852a' }} />
                  Assinaturas
                </span>
                <span className="lp-preview-row-val">− R$ 148</span>
              </div>
              <div className="lp-preview-row">
                <span className="lp-preview-row-label">
                  <span className="lp-preview-row-dot" style={{ background: '#3a6ea5' }} />
                  Cartão
                </span>
                <span className="lp-preview-row-val">− R$ 720</span>
              </div>
              <div className="lp-preview-row">
                <span className="lp-preview-row-label">
                  <span className="lp-preview-row-dot" style={{ background: '#7a6b8a' }} />
                  Parcelamentos
                </span>
                <span className="lp-preview-row-val">− R$ 380</span>
              </div>
            </div>
            <div className="lp-preview-divider" />
            <div className="lp-preview-save">
              <span className="lp-preview-save-label">Disponível pra guardar</span>
              <span className="lp-preview-save-val">R$ 1.412</span>
            </div>
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
              O Folium não exige que você registre cada compra. Você só precisa configurar o cenário do mês — o resto é acompanhamento.
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
          Teste tudo sem pagar nada. Passados os 7 dias, são R$27/mês — um plano, tudo incluso. Cancele quando quiser.
        </p>
        <div className="lp-price-card reveal reveal-delay-3">
          <div className="lp-price-badge">7 dias grátis</div>
          <div className="lp-price-label">Depois do teste</div>
          <div className="lp-price-value">
            <span className="lp-price-currency">R$</span>
            <span className="lp-price-amount">27</span>
          </div>
          <div className="lp-price-period">por mês · cancele quando quiser</div>
          <ul className="lp-price-perks">
            <li>7 dias grátis, sem cobrança hoje</li>
            <li>Todos os painéis desbloqueados</li>
            <li>Dados salvos na nuvem</li>
            <li>Funciona no celular e no desktop</li>
            <li>Histórico mensal ilimitado</li>
            <li>Cancele quando quiser</li>
          </ul>
          <button className="lp-cta-price" onClick={onGetStarted}>
            Começar 7 dias grátis
          </button>
          <p className="lp-price-note">Sem cobrança hoje · depois R$27/mês</p>
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
        <button className="lp-cta-final reveal reveal-delay-2" onClick={onGetStarted}>
          Começar 7 dias grátis
        </button>
        <p className="lp-final-note reveal reveal-delay-3">Depois R$27/mês · cancele quando quiser</p>
      </section>

      {/* ── footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer-brand">
          <div className="lp-logo">F</div>
          <span style={{ color: '#cfd7e3', fontSize: 15, fontWeight: 600 }}>Folium</span>
        </div>
        <span className="lp-footer-copy">© {new Date().getFullYear()} Folium. Todos os direitos reservados.</span>
      </footer>

    </div>
  );
}
