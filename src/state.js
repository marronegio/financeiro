export const STORAGE_KEY = 'dashboard-financeiro-v3';

// Fábrica para sempre devolver objetos/arrays novos (sem referências compartilhadas).
export const createDefaultState = () => ({
  salario: '',
  guardar: '',
  split: 40,
  tab: 'plan',
  despesas: [
    { nome: 'Aluguel', valor: '', venc: '' },
    { nome: 'Luz', valor: '', venc: '' },
    { nome: 'Internet', valor: '', venc: '' },
    { nome: 'Telefone', valor: '', venc: '' },
  ],
  assinaturas: [{ nome: '', valor: '' }],
  rendaExtra: [{ nome: '', valor: '' }], // ganhos avulsos do mês (freela, venda, bônus); zera no fechamento
  somarRendaExtra: true, // se a renda extra entra na sobra do planejamento
  cartao: [{ nome: '', valor: '', cat: '' }],
  cardCategories: CARD_CATEGORIES.map((c) => ({ ...c })), // etiquetas das compras (editáveis pelo usuário)
  abates: [], // valores abatidos da fatura (estornos, cashback, créditos)
  parcelamentos: [{ nome: '', total: '', parcelas: '', pagas: '' }],
  metas: [], // metas de economia: { nome, valor (alvo), guardado (já juntei), prazo 'YYYY-MM' }
  avatar: '', // foto de perfil opcional (data URL); vazio = mostra as iniciais
  onboarded: false, // true depois que o usuário viu/pulou o tour de introdução
  emailVencimentos: true, // receber por e-mail o aviso de "vence amanhã" das despesas fixas
  // Histórico / ciclo mensal.
  recebimentoDia: '', // dia do mês em que recebe o salário (1–31)
  faturaDia: '', // dia do mês em que paga a fatura (1–31)
  ultimoFechamento: '', // 'YYYY-MM' do último mês já fechado (controle interno)
  historico: [], // resumos mensais { periodo, salario, gasto, guardado, meta }
});

// ── Perfis (plano Duo) ──────────────────────────────────────────────
// O blob salvo na nuvem (v2) guarda 1 ou 2 perfis, cada um com seu próprio
// estado financeiro completo (a forma de createDefaultState). O perfil 'main'
// é o titular da conta; 'partner' só existe no plano Duo.
export const PROFILE_NAMES = { main: 'Você', partner: 'Parceiro(a)' };

export const createDefaultProfiles = () => ({
  v: 2,
  activeProfile: 'main',
  profiles: {
    main: { name: PROFILE_NAMES.main, data: createDefaultState() },
  },
});

// Normaliza o que veio do banco para a forma v2. Aceita:
//  - null/{}                  → conta nova
//  - estado plano antigo (v1) → vira profiles.main.data, sem perda
//  - já v2                    → retorna garantindo que 'main' exista
export const migrateState = (raw) => {
  if (raw && raw.v === 2 && raw.profiles && raw.profiles.main) {
    return raw;
  }
  const flat = raw && typeof raw === 'object' ? raw : {};
  return {
    v: 2,
    activeProfile: 'main',
    profiles: {
      main: { name: PROFILE_NAMES.main, data: { ...createDefaultState(), ...flat } },
    },
  };
};

export const TABS = [
  { id: 'plan', label: 'Planejamento', ico: '◷' },
  { id: 'rendaextra', label: 'Renda extra', ico: '⊕' },
  { id: 'despesas', label: 'Despesas fixas', ico: '⊟' },
  { id: 'assinaturas', label: 'Assinaturas', ico: '↻' },
  { id: 'cartao', label: 'Cartão de crédito', ico: '▣' },
  { id: 'parcelamentos', label: 'Parcelamentos', ico: '≣' },
  { id: 'economias', label: 'Economias', ico: '◎' },
  { id: 'historico', label: 'Histórico', ico: '◴' },
  { id: 'config', label: 'Configurações', ico: '⚙' },
];

// Categorias/etiquetas para as compras no cartão.
export const CARD_CATEGORIES = [
  { id: 'alimentacao', label: 'Alimentação', color: '#e0564c' },
  { id: 'transporte', label: 'Transporte', color: '#3a6ea5' },
  { id: 'lazer', label: 'Lazer', color: '#9b6bff' },
  { id: 'saude', label: 'Saúde', color: '#0e9f6e' },
  { id: 'casa', label: 'Casa', color: '#d98a00' },
  { id: 'compras', label: 'Compras', color: '#635bff' },
  { id: 'outros', label: 'Outros', color: '#8898aa' },
];

// Categorias efetivas do perfil: usa as personalizadas se houver, senão o padrão.
// Garante o fallback para perfis salvos antes de a lista ser editável.
export const getCardCategories = (state) =>
  state?.cardCategories?.length ? state.cardCategories : CARD_CATEGORIES;
