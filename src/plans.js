// Fonte única dos planos vendidos (Solo/Duo × Mensal/Anual). Usado pela landing,
// pelo paywall e como chave enviada à edge function de checkout, que mapeia cada
// chave para o price ID correspondente no Stripe.

export const planKey = (tier, cycle) => `${tier}-${cycle}`;

export const PLANS = {
  'solo-monthly': {
    tier: 'solo', cycle: 'monthly',
    label: 'Solo · Mensal', badge: '',
    amount: '37', cents: ',90',
    period: 'por mês · cancele quando quiser',
    economy: '',
    note: 'R$37,90/mês · cartão ou PIX · cancele quando quiser',
    short: 'R$37,90/mês',
    // Valor cobrado por ciclo (BRL) — usado no evento Purchase do Meta Pixel.
    value: 37.9,
  },
  'solo-annual': {
    tier: 'solo', cycle: 'annual',
    label: 'Solo · Anual', badge: 'Mais popular',
    // Anual mostra o preço CHEIO em destaque (o que é cobrado de fato) e o
    // equivalente mensal como apoio — evita parecer cobrança de R$19,90.
    amount: '238', cents: ',80',
    period: 'por ano · equivale a R$19,90 por mês',
    economy: 'Economize R$216 por ano',
    note: 'R$238,80/ano · cartão ou PIX · cancele quando quiser',
    short: 'R$238,80/ano (R$19,90/mês)',
    value: 238.8,
  },
  'duo-monthly': {
    tier: 'duo', cycle: 'monthly',
    label: 'Duo · Mensal', badge: '',
    amount: '67', cents: ',90',
    period: 'por mês · 2 perfis · cancele quando quiser',
    economy: '',
    note: 'R$67,90/mês · cartão ou PIX · cancele quando quiser',
    short: 'R$67,90/mês',
    value: 67.9,
  },
  'duo-annual': {
    tier: 'duo', cycle: 'annual',
    label: 'Duo · Anual', badge: 'Ideal para casais',
    amount: '478', cents: ',80',
    period: 'por ano · 2 perfis · equivale a R$39,90 por mês',
    economy: 'Economize R$336 por ano',
    note: 'R$478,80/ano · cartão ou PIX · cancele quando quiser',
    short: 'R$478,80/ano (R$39,90/mês)',
    value: 478.8,
  },
};


const PERKS_BASE = [
  'Assistente com IA (texto, áudio e imagem)',
  'Todos os painéis desbloqueados',
  'Pague no cartão de crédito ou PIX',
  'Dados salvos na nuvem',
  'Funciona no celular e no desktop',
  'Histórico mensal ilimitado',
  'Suporte via e-mail',
  'Cancele quando quiser',
];

// Créditos de IA inclusos por mês, por ciclo — espelha o gate do backend
// (_shared/aiCredits.ts: mensal 250, anual 900). No Duo, cada perfil tem os seus.
const AI_CREDITS = { monthly: 250, annual: 900 };

// Lista de vantagens do card. Itens são { text, special } — os `special` ganham
// destaque visual na landing (ex.: os créditos de IA).
export const planPerks = (tier, cycle) => {
  const perks = tier === 'duo'
    ? ['Dois perfis independentes — você + parceiro(a)', ...PERKS_BASE]
    : [...PERKS_BASE];
  const credits = AI_CREDITS[cycle] || AI_CREDITS.monthly;
  const items = perks.map((text) => ({ text, special: false }));
  // Créditos logo abaixo do item do assistente, que é o que eles alimentam.
  const aiIndex = items.findIndex((p) => p.text.startsWith('Assistente com IA'));
  items.splice(aiIndex + 1, 0, {
    text: `${credits} créditos de IA por mês`,
    special: true,
  });
  return items;
};

// Aceita as chaves novas e os valores antigos ('monthly'/'annual' = Solo).
// Default seguro: Solo mensal.
export const normalizePlanKey = (v) => {
  if (v === 'monthly' || v === 'annual') return `solo-${v}`;
  if (PLANS[v]) return v;
  return 'solo-monthly';
};
