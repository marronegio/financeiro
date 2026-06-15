export const STORAGE_KEY = 'dashboard-financeiro-v3';

// Fábrica para sempre devolver objetos/arrays novos (sem referências compartilhadas).
export const createDefaultState = () => ({
  salario: '',
  guardar: '',
  split: 40,
  tab: 'plan',
  despesas: [
    { nome: 'Aluguel', valor: '' },
    { nome: 'Luz', valor: '' },
    { nome: 'Internet', valor: '' },
    { nome: 'Telefone', valor: '' },
  ],
  assinaturas: [{ nome: '', valor: '' }],
  cartao: [{ nome: '', valor: '', cat: '' }],
  parcelamentos: [{ nome: '', total: '', parcelas: '', pagas: '' }],
  metaEconomia: '', // meta total de economia (quanto quer juntar no acumulado)
  avatar: '', // foto de perfil opcional (data URL); vazio = mostra as iniciais
  onboarded: false, // true depois que o usuário viu/pulou o tour de introdução
  // Histórico / ciclo mensal.
  recebimentoDia: '', // dia do mês em que recebe o salário (1–31)
  faturaDia: '', // dia do mês em que paga a fatura (1–31)
  ultimoFechamento: '', // 'YYYY-MM' do último mês já fechado (controle interno)
  historico: [], // resumos mensais { periodo, salario, gasto, guardado, meta }
});

export const TABS = [
  { id: 'plan', label: 'Planejamento', ico: '◷' },
  { id: 'despesas', label: 'Despesas fixas', ico: '⊟' },
  { id: 'assinaturas', label: 'Assinaturas', ico: '↻' },
  { id: 'cartao', label: 'Cartão de crédito', ico: '▣' },
  { id: 'parcelamentos', label: 'Parcelamentos', ico: '≣' },
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
