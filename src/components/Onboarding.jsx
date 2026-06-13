import React, { useState, useEffect } from 'react';

const PAD = 8;
const TOOLTIP_W = 272;
const MARGIN = 16;

const STEPS = [
  {
    tab: null,
    target: null,
    icon: '◈',
    title: 'Bem-vindo ao Folium',
    description:
      'Um lugar simples pra você entender pra onde vai o seu dinheiro. Vamos te mostrar o básico em menos de um minuto.',
  },
  {
    tab: 'plan',
    target: '[data-tour="tab-plan"]',
    icon: '◷',
    title: 'Planejamento',
    description:
      'Comece informando seu salário e quanto quer guardar por mês. O app calcula quanto sobra e como dividir entre crédito e débito.',
  },
  {
    tab: 'despesas',
    target: '[data-tour="tab-despesas"]',
    icon: '⊟',
    title: 'Despesas Fixas',
    description:
      'Adicione tudo que você paga todo mês: aluguel, luz, internet. Esses valores entram automaticamente no total de gastos.',
  },
  {
    tab: 'assinaturas',
    target: '[data-tour="tab-assinaturas"]',
    icon: '↻',
    title: 'Assinaturas',
    description:
      'Netflix, Spotify, iCloud — cobranças recorrentes somam mais do que parecem. Mantenha-as separadas para ter visibilidade.',
  },
  {
    tab: 'cartao',
    target: '[data-tour="tab-cartao"]',
    icon: '▣',
    title: 'Cartão de Crédito',
    description:
      'A cada compra avulsa no crédito, adicione aqui. O app mostra quanto ainda cabe dentro do limite que você planejou.',
  },
  {
    tab: 'parcelamentos',
    target: '[data-tour="tab-parcelamentos"]',
    icon: '≣',
    title: 'Parcelamentos',
    description:
      'Comprou parcelado? Cadastre aqui e o app avança as parcelas automaticamente todo mês, até quitá-las.',
  },
  {
    tab: 'historico',
    target: '[data-tour="tab-historico"]',
    icon: '◴',
    title: 'Histórico Mensal',
    description:
      'Quando chegar o dia do salário, feche o mês aqui. O cartão é zerado, as parcelas avançam e um resumo fica salvo.',
  },
];

function measureTarget(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  // Ignora elemento fora da viewport (ex: sidebar fechada no mobile)
  if (r.right < 0 || r.left > window.innerWidth || r.bottom < 0 || r.top > window.innerHeight) return null;
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}

function tooltipPosition(rect) {
  if (!rect) return null;
  const spaceRight = window.innerWidth - rect.right - MARGIN;
  const cy = rect.top + rect.height / 2;

  if (spaceRight >= TOOLTIP_W + MARGIN) {
    // Tooltip à direita do spotlight
    const top = Math.max(MARGIN, Math.min(window.innerHeight - 260, cy - 120));
    return { top, left: rect.right + MARGIN, arrowDir: 'left' };
  }
  // Fallback: tooltip abaixo
  const left = Math.max(MARGIN, Math.min(window.innerWidth - TOOLTIP_W - MARGIN, rect.left + rect.width / 2 - TOOLTIP_W / 2));
  return { top: rect.bottom + MARGIN, left, arrowDir: 'top' };
}

export default function Onboarding({ onFinish, onSkip, onStepChange }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setRect(measureTarget(STEPS[step].target));
    }, 60);
    return () => clearTimeout(id);
  }, [step]);

  function goNext() {
    if (step < STEPS.length - 1) {
      const next = step + 1;
      setStep(next);
      if (STEPS[next].tab) onStepChange(STEPS[next].tab);
    } else {
      onFinish();
    }
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const dots = (
    <div className="ob-dots">
      {STEPS.map((_, i) => (
        <span key={i} className={`ob-dot${i === step ? ' active' : ''}`} />
      ))}
    </div>
  );

  const body = (
    <>
      {dots}
      <div className="ob-icon">{current.icon}</div>
      <h2 className="ob-title">{current.title}</h2>
      <p className="ob-desc">{current.description}</p>
      <div className="ob-actions">
        <button className="ob-skip" onClick={onSkip}>Pular</button>
        <button className="ob-next" onClick={goNext}>
          {isLast ? 'Começar' : 'Próximo →'}
        </button>
      </div>
    </>
  );

  // Passo de boas-vindas ou fallback (mobile sem sidebar visível): card centralizado
  if (!rect) {
    return (
      <div className="ob-backdrop">
        <div className="ob-card">{body}</div>
      </div>
    );
  }

  const spotlight = {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };

  const tip = tooltipPosition(rect);

  return (
    <>
      <div className="ob-clickblock" />
      <div className="ob-spotlight" style={spotlight} />
      <div
        className={`ob-tooltip ob-arrow-${tip.arrowDir}`}
        style={{ top: tip.top, left: tip.left, width: TOOLTIP_W }}
      >
        {body}
      </div>
    </>
  );
}
