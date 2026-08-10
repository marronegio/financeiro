// Regras compartilhadas pelas duas listas de compras avulsas do mês: crédito à
// vista (CartaoPanel) e débito/Pix (DebitoPanel). As listas têm a mesma forma
// ({ nome, valor, cat }) e as mesmas etiquetas, então ordenar e somar por
// categoria é o mesmo trabalho nas duas — o que muda é só quem paga a conta.

import { toNumber } from './money.js';

export const SORTS = [
  { id: 'add', label: 'Data' },
  { id: 'valor', label: 'Valor' },
  { id: 'categoria', label: 'Categoria' },
];

// Ordem de exibição como uma lista de ÍNDICES ORIGINAIS: reordenar a tela sem
// mexer nos índices é o que mantém a edição e a remoção apontando para o item
// certo. Compras ainda vazias (sem valor) ficam sempre no fim, junto do botão
// "Adicionar", e empates preservam a ordem de adição (ordenação estável).
export function ordemCompras(items, categories, sort) {
  const order = items.map((_, i) => i);
  if (sort === 'add') return order;

  const catRank = new Map(categories.map((cat, i) => [cat.id, i]));
  const rankOf = (it) =>
    catRank.has(it.cat) ? catRank.get(it.cat) : catRank.get('outros') ?? categories.length;

  return order.sort((a, b) => {
    const ia = items[a];
    const ib = items[b];
    const va = toNumber(ia.valor);
    const vb = toNumber(ib.valor);
    if ((va === 0) !== (vb === 0)) return va === 0 ? 1 : -1;
    const cmp = sort === 'valor' ? vb - va : rankOf(ia) - rankOf(ib);
    return cmp !== 0 ? cmp : a - b;
  });
}

// Total gasto por categoria, da maior para a menor. Compras sem etiqueta — ou
// com uma etiqueta que o usuário apagou depois — caem em "Outros".
export function totaisPorCategoria(items, categories) {
  const known = new Set(categories.map((cat) => cat.id));
  return categories
    .map((cat) => ({
      ...cat,
      total: items.reduce((s, it) => {
        const id = known.has(it.cat) ? it.cat : 'outros';
        return s + (id === cat.id ? toNumber(it.valor) : 0);
      }, 0),
    }))
    .filter((cat) => cat.total > 0)
    .sort((a, b) => b.total - a.total);
}
