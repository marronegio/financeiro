// Fonte única dos planos vendidos (Solo/Duo × Mensal/Anual). Usado pela landing,
// pelo paywall e como chave enviada à edge function de checkout, que mapeia cada
// chave para o price ID correspondente no Stripe.

export const planKey = (tier, cycle) => `${tier}-${cycle}`;

export const PLANS = {
  'solo-monthly': {
    tier: 'solo', cycle: 'monthly',
    label: 'Solo · Mensal', badge: '',
    amount: '17', cents: ',90',
    period: 'por mês · cancele quando quiser',
    economy: '',
    note: 'R$17,90/mês · cartão ou PIX · cancele quando quiser',
    short: 'R$17,90/mês',
    // Valor cobrado por ciclo (BRL) — usado no evento Purchase do Meta Pixel.
    value: 17.9,
  },
  'solo-annual': {
    tier: 'solo', cycle: 'annual',
    label: 'Solo · Anual', badge: 'Mais popular',
    // Anual mostra o preço CHEIO em destaque (o que é cobrado de fato) e o
    // equivalente mensal como apoio — evita parecer cobrança de R$11,90.
    amount: '142', cents: ',80',
    period: 'por ano · equivale a R$11,90 por mês',
    economy: 'Economize R$72 por ano',
    note: 'R$142,80/ano · cartão ou PIX · cancele quando quiser',
    short: 'R$142,80/ano (R$11,90/mês)',
    value: 142.8,
  },
  'duo-monthly': {
    tier: 'duo', cycle: 'monthly',
    label: 'Duo · Mensal', badge: '',
    amount: '29', cents: ',90',
    period: 'por mês · 2 perfis · cancele quando quiser',
    economy: '',
    note: 'R$29,90/mês · cartão ou PIX · cancele quando quiser',
    short: 'R$29,90/mês',
    value: 29.9,
  },
  'duo-annual': {
    tier: 'duo', cycle: 'annual',
    label: 'Duo · Anual', badge: 'Ideal para casais',
    amount: '238', cents: ',80',
    period: 'por ano · 2 perfis · equivale a R$19,90 por mês',
    economy: 'Economize R$120 por ano',
    note: 'R$238,80/ano · cartão ou PIX · cancele quando quiser',
    short: 'R$238,80/ano (R$19,90/mês)',
    value: 238.8,
  },
};


// ── Plano grátis ────────────────────────────────────────────────────
// Só existe na categoria Solo e não passa por checkout: é o estado de quem
// criou a conta e não assinou. Fica aqui junto dos pagos para a landing, o
// paywall e o app nativo descreverem o tier a partir de uma fonte só.
export const FREE_PLAN = {
  tier: 'solo',
  cycle: 'free',
  label: 'Solo · Grátis',
  badge: '',
  amount: '0', cents: '',
  period: 'para sempre · sem cartão',
  note: 'Sem cartão de crédito · comece em menos de 1 minuto',
};

// Curtos e no mesmo ritmo do PERKS_BASE — os três cards ficam lado a lado, então
// item que quebra em três linhas desalinha a coluna toda.
export const FREE_PERKS = [
  'Planejamento do mês completo',
  'Despesas fixas ilimitadas',
  'Cartão de crédito e limite',
  'Parcelamentos (sem projeção)',
  '1 meta de economia',
  'Avisos de vencimento no celular',
  'Dados salvos na nuvem',
  'Funciona no celular e no desktop',
];

// O que o grátis não tem. Fica explícito no card, como lista marcada com ✕, para
// a diferença entre os planos aparecer antes do cadastro, não depois.
export const FREE_MISSING = [
  'Assistente com IA',
  'Histórico mensal',
  'Assinaturas',
  'Doações',
  'Renda extra',
];

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
