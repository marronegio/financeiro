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
  cartao: [{ nome: '', valor: '' }],
  parcelamentos: [{ nome: '', total: '', parcelas: '', pagas: '' }],
});

export const TABS = [
  { id: 'plan', label: 'Planejamento', ico: '◷' },
  { id: 'despesas', label: 'Despesas fixas', ico: '⊟' },
  { id: 'assinaturas', label: 'Assinaturas', ico: '↻' },
  { id: 'cartao', label: 'Cartão de crédito', ico: '▣' },
  { id: 'parcelamentos', label: 'Parcelamentos', ico: '≣' },
];
