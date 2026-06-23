// Fonte única dos planos vendidos (Solo/Duo × Mensal/Anual). Usado pela landing,
// pelo paywall e como chave enviada à edge function de checkout, que mapeia cada
// chave para o price ID correspondente no Stripe.

export const planKey = (tier, cycle) => `${tier}-${cycle}`;

export const PLANS = {
  'solo-monthly': {
    tier: 'solo', cycle: 'monthly',
    amount: '27', cents: '',
    period: 'por mês · cancele quando quiser',
    economy: '',
    note: 'Sem cobrança hoje · depois R$27/mês',
    short: 'R$27/mês',
    // Valor cobrado por ciclo (BRL) — usado no evento Purchase do Meta Pixel.
    value: 27,
  },
  'solo-annual': {
    tier: 'solo', cycle: 'annual',
    amount: '19', cents: ',90',
    period: 'por mês · cobrado R$238,80 por ano',
    economy: 'Economize R$85,20 por ano',
    note: 'Sem cobrança hoje · depois R$238,80/ano',
    short: 'R$238,80/ano (R$19,90/mês)',
    value: 238.8,
  },
  'duo-monthly': {
    tier: 'duo', cycle: 'monthly',
    amount: '44', cents: ',90',
    period: 'por mês · 2 perfis · cancele quando quiser',
    economy: '',
    note: 'Sem cobrança hoje · depois R$44,90/mês',
    short: 'R$44,90/mês',
    value: 44.9,
  },
  'duo-annual': {
    tier: 'duo', cycle: 'annual',
    amount: '39', cents: ',90',
    period: 'por mês · 2 perfis · cobrado R$478,80 por ano',
    economy: 'Economize R$60 por ano',
    note: 'Sem cobrança hoje · depois R$478,80/ano',
    short: 'R$478,80/ano (R$39,90/mês)',
    value: 478.8,
  },
};

// Desconto do anual sobre o mensal, por tier — usado no selo do seletor.
export const ANNUAL_SAVE = { solo: '−26%', duo: '−11%' };

const PERKS_BASE = [
  '7 dias grátis, sem cobrança hoje',
  'Todos os painéis desbloqueados',
  'Dados salvos na nuvem',
  'Funciona no celular e no desktop',
  'Histórico mensal ilimitado',
  'Cancele quando quiser',
];

export const planPerks = (tier) =>
  tier === 'duo'
    ? ['Dois perfis independentes — você + parceiro(a)', ...PERKS_BASE]
    : PERKS_BASE;

// Aceita as chaves novas e os valores antigos ('monthly'/'annual' = Solo).
// Default seguro: Solo mensal.
export const normalizePlanKey = (v) => {
  if (v === 'monthly' || v === 'annual') return `solo-${v}`;
  if (PLANS[v]) return v;
  return 'solo-monthly';
};
