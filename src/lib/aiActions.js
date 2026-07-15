// Traduz as "tool calls" que a IA devolve em mutações no estado financeiro.
//
// A OpenAI manda valores em reais (number). O estado guarda dinheiro como string
// mascarada ("1.234,56"), então convertemos com o mesmo helper das telas para
// manter tudo consistente. Nada aqui fala com a rede — só transforma o estado.

import { maskMoney, BRL } from '../money.js';
import { getCardCategories, TABS } from '../state.js';

// number (reais) -> string mascarada do app ("1.234,56").
const money = (reais) => maskMoney(String(Math.round((Number(reais) || 0) * 100)));

// Só aceita dias plausíveis de vencimento (1–31); fora disso, deixa em branco.
const diaVenc = (v) => {
  const n = parseInt(v, 10);
  return n >= 1 && n <= 31 ? String(n) : '';
};

const inteiro = (v, fallback = '') => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? String(n) : fallback;
};

const TAB_IDS = new Set(TABS.map((t) => t.id));

// Aplica a ação sobre o estado e devolve o novo estado (função pura, segura para
// usar dentro de setState(s => applyAiAction(s, ...))).
export function applyAiAction(state, name, args = {}) {
  const push = (kind, item) => ({ ...state, [kind]: [...(state[kind] || []), item] });

  switch (name) {
    case 'adicionar_compra_cartao': {
      const cats = getCardCategories(state).map((cat) => cat.id);
      const cat = cats.includes(args.categoria) ? args.categoria : '';
      return push('cartao', { nome: args.nome || '', valor: money(args.valor), cat });
    }
    case 'adicionar_despesa_fixa':
      return push('despesas', {
        nome: args.nome || '',
        valor: money(args.valor),
        venc: diaVenc(args.vencimento),
      });
    case 'adicionar_assinatura':
      return push('assinaturas', { nome: args.nome || '', valor: money(args.valor) });
    case 'adicionar_renda_extra':
      return push('rendaExtra', { nome: args.nome || '', valor: money(args.valor) });
    case 'adicionar_doacao':
      return push('doacoes', {
        nome: args.nome || '',
        valor: money(args.valor),
        recorrente: !!args.recorrente,
      });
    case 'adicionar_parcelamento':
      return push('parcelamentos', {
        nome: args.nome || '',
        total: money(args.total),
        parcelas: inteiro(args.parcelas),
        pagas: inteiro(args.pagas, '0'),
      });
    case 'adicionar_meta':
      return push('metas', {
        nome: args.nome || '',
        valor: money(args.valor),
        guardado: '',
        prazo: typeof args.prazo === 'string' ? args.prazo : '',
      });
    case 'navegar_para_tela':
      return TAB_IDS.has(args.tab) ? { ...state, tab: args.tab } : state;
    default:
      return state;
  }
}

// Mensagem curta de confirmação que volta para a IA como resultado da ferramenta
// (e que também podemos mostrar ao usuário). Derivada só dos argumentos.
export function describeAction(name, args = {}) {
  switch (name) {
    case 'adicionar_compra_cartao':
      return `Compra "${args.nome}" de ${BRL(args.valor)} adicionada ao cartão.`;
    case 'adicionar_despesa_fixa':
      return `Despesa fixa "${args.nome}" de ${BRL(args.valor)} adicionada.`;
    case 'adicionar_assinatura':
      return `Assinatura "${args.nome}" de ${BRL(args.valor)}/mês adicionada.`;
    case 'adicionar_renda_extra':
      return `Renda extra "${args.nome}" de ${BRL(args.valor)} registrada.`;
    case 'adicionar_doacao':
      return `Doação "${args.nome}" de ${BRL(args.valor)}${args.recorrente ? '/mês' : ''} adicionada.`;
    case 'adicionar_parcelamento':
      return `Parcelamento "${args.nome}" (${BRL(args.total)} em ${args.parcelas}x) adicionado.`;
    case 'adicionar_meta':
      return `Meta "${args.nome}" de ${BRL(args.valor)} criada.`;
    case 'navegar_para_tela': {
      const label = TABS.find((t) => t.id === args.tab)?.label || args.tab;
      return TAB_IDS.has(args.tab) ? `Abri a tela de ${label}.` : 'Tela não encontrada.';
    }
    default:
      return 'Ação não reconhecida.';
  }
}
