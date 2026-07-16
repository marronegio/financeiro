import React, { useState, useEffect } from 'react';
import { isNativeApp } from '../lib/native.js';

const PAD = 8;
const TOOLTIP_W = 272;
const MARGIN = 16;

const STEPS = [
  {
    tab: null,
    target: null,
    icon: '◈',
    title: 'Bem-vindo ao DinPrev',
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
    tab: 'rendaextra',
    target: '[data-tour="tab-rendaextra"]',
    sheet: true, // no app, este painel mora no sheet "Mais" — o tour o abre
    icon: '⊕',
    title: 'Renda Extra',
    description:
      'Ganhou um dinheiro a mais? Freela, venda, bônus — lance aqui. Soma à sua renda disponível e zera sozinho no fechamento do mês.',
  },
  {
    tab: 'despesas',
    target: '[data-tour="tab-despesas"]',
    sheet: true,
    icon: '⊟',
    title: 'Despesas Fixas',
    description:
      'Adicione tudo que você paga todo mês: aluguel, luz, internet. Esses valores entram automaticamente no total de gastos.',
  },
  {
    tab: 'assinaturas',
    target: '[data-tour="tab-assinaturas"]',
    sheet: true,
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
    sheet: true,
    icon: '≣',
    title: 'Parcelamentos',
    description:
      'Comprou parcelado? Cadastre aqui e o app avança as parcelas automaticamente todo mês, até quitá-las.',
  },
  {
    tab: 'economias',
    target: '[data-tour="tab-economias"]',
    sheet: true,
    icon: '◎',
    title: 'Economias',
    description:
      'Crie metas de quanto quer juntar e até quando. O app calcula quanto poupar por mês pra chegar no prazo, e um resumo aparece no Planejamento.',
  },
  {
    tab: 'historico',
    target: '[data-tour="tab-historico"]',
    icon: '◴',
    title: 'Histórico Mensal',
    description:
      'Quando chegar o dia do salário, feche o mês aqui. O cartão é zerado, as parcelas avançam e um resumo fica salvo.',
  },
  {
    tab: null,
    target: '[data-tour="ai-fab"]',
    icon: '✦',
    title: 'Mr. Din, seu assistente',
    description:
      'Este é o Mr. Din, seu assistente com IA. Ele analisa seus gastos, dá dicas e lança despesas e receitas por você — é só conversar. Também entende áudio (mande um recado de voz, tipo no WhatsApp) e imagens (fotografe um comprovante, boleto ou nota fiscal e ele lança sozinho).',
  },
];

// Só no app: apresenta o botão "Mais" antes dos painéis que moram dentro dele.
// Os passos marcados com `sheet: true` abrem o sheet e destacam o item lá dentro,
// ensinando onde cada área fica no menu.
const MAIS_STEP = {
  tab: null,
  target: '[data-tour="tab-mais"]',
  icon: '⊞',
  title: 'O botão "Mais"',
  description:
    'Os demais painéis moram aqui dentro. Nos próximos passos o menu abre sozinho e mostra onde fica cada um.',
};

const APP_STEPS = [...STEPS.slice(0, 2), MAIS_STEP, ...STEPS.slice(2)];

function measureTarget(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  // Ignora elemento fora da viewport (ex: sidebar fechada no mobile)
  if (r.right < 0 || r.left > window.innerWidth || r.bottom < 0 || r.top > window.innerHeight) return null;
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}

// Altura estimada do tooltip (dots + ícone + título + descrição + botões).
// Varia com o texto, então usamos um teto seguro: um ramo só é escolhido se
// couber ESSA altura — senão cai no próximo, e por fim no card centralizado.
const TOOLTIP_H = 360;

function tooltipPosition(rect) {
  if (!rect) return null;
  const spaceRight = window.innerWidth - rect.right - MARGIN;
  const spaceBelow = window.innerHeight - rect.bottom - MARGIN;
  const cy = rect.top + rect.height / 2;
  const clampLeft = (l) =>
    Math.max(MARGIN, Math.min(window.innerWidth - TOOLTIP_W - MARGIN, l));

  // Alvo colado no rodapé (itens do menu inferior do app): as posições lateral
  // e abaixo não têm altura — vai direto para o ramo "acima do elemento".
  const nearBottom = rect.top > window.innerHeight - 150;

  if (spaceRight >= TOOLTIP_W + MARGIN && !nearBottom) {
    // Tooltip à direita do spotlight
    const top = Math.max(MARGIN, Math.min(window.innerHeight - TOOLTIP_H - MARGIN, cy - 120));
    return { top, left: rect.right + MARGIN, arrowDir: 'left' };
  }
  if (spaceBelow >= TOOLTIP_H) {
    // Tooltip abaixo do spotlight
    const left = clampLeft(rect.left + rect.width / 2 - TOOLTIP_W / 2);
    return { top: rect.bottom + MARGIN, left, arrowDir: 'top' };
  }
  if (rect.top >= TOOLTIP_H + MARGIN) {
    // Tooltip acima do elemento (ex: botão flutuante ou item do menu inferior
    // do app). Usa `bottom` pra não depender da altura real. A folga extra
    // evita colidir com o botão central da IA, que salta acima da barra.
    const left = clampLeft(rect.right - TOOLTIP_W);
    return { bottom: window.innerHeight - rect.top + MARGIN + 24, left, arrowDir: 'bottom' };
  }
  // Não coube em lugar nenhum (tela muito baixa): sinaliza para o chamador
  // usar o card centralizado, mantendo o spotlight no alvo.
  return null;
}

export default function Onboarding({ onFinish, onSkip, onStepChange, onMenuChange = () => {} }) {
  const steps = isNativeApp ? APP_STEPS : STEPS;
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);

  // No app, abre o sheet "Mais" nos passos dos painéis que vivem lá dentro
  // (e fecha nos demais). A medição espera a animação do sheet (~280ms).
  useEffect(() => {
    if (isNativeApp) onMenuChange(!!steps[step].sheet);
    const id = setTimeout(() => {
      setRect(measureTarget(steps[step].target));
    }, isNativeApp ? 380 : 60);
    return () => clearTimeout(id);
  }, [step]);

  function goNext() {
    if (step < steps.length - 1) {
      const next = step + 1;
      setStep(next);
      if (steps[next].tab) onStepChange(steps[next].tab);
    } else {
      onFinish();
    }
  }

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const dots = (
    <div className="ob-dots">
      {steps.map((_, i) => (
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

  // Passo de boas-vindas ou fallback (alvo invisível, ou tooltip sem lugar que
  // caiba na tela): card centralizado.
  const tip = tooltipPosition(rect);
  if (!rect || !tip) {
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

  const tipStyle = { left: tip.left, width: TOOLTIP_W };
  if (tip.top != null) tipStyle.top = tip.top;
  if (tip.bottom != null) tipStyle.bottom = tip.bottom;

  return (
    <>
      <div className="ob-clickblock" />
      <div className="ob-spotlight" style={spotlight} />
      <div className={`ob-tooltip ob-arrow-${tip.arrowDir}`} style={tipStyle}>
        {body}
      </div>
    </>
  );
}
