// O que o plano grátis (Solo, sem assinatura) inclui — e o que fica no Pro.
// plans.js descreve isso para VENDER na landing; aqui está o que o app APLICA.
// Os dois precisam contar a mesma história: ao mexer num, confira o outro.
//
// A autoridade sobre o que custa dinheiro (a IA) fica no backend
// (supabase/functions/_shared/aiCredits.ts). Daqui para baixo é só interface.

// Abas exclusivas do Pro. Continuam VISÍVEIS com cadeado — no menu, ou na barra
// de abas da janela de despesas, no caso de 'assinaturas' e 'debito': quem está
// no grátis precisa enxergar o tamanho do produto que não está usando — esconder
// faz o app parecer menor do que é.
export const PRO_TABS = ['rendaextra', 'assinaturas', 'doacoes', 'debito'];

export const isProTab = (tabId) => PRO_TABS.includes(tabId);

// Teto de metas de economia no grátis. Uma meta prova que a funcionalidade
// existe e funciona; a segunda é o motivo de assinar.
export const FREE_METAS = 1;

// Motivo mostrado no paywall, conforme o que a pessoa tentou usar. Sem isso o
// popup de pagamento aparece do nada e parece cobrança, não oferta.
export const UPGRADE_REASONS = {
  rendaextra: 'Registrar renda extra faz parte do plano Pro.',
  assinaturas: 'Controlar assinaturas faz parte do plano Pro.',
  debito: 'Acompanhar os gastos no débito e no Pix faz parte do plano Pro.',
  doacoes: 'Acompanhar doações faz parte do plano Pro.',
  ia: 'O assistente com IA (texto, áudio e imagem) faz parte do plano Pro.',
  historico: 'Ver o histórico dos meses fechados faz parte do plano Pro.',
  projecao: 'A projeção dos próximos meses faz parte do plano Pro.',
  metas: `No grátis você tem ${FREE_METAS} meta de economia. O Pro libera quantas quiser.`,
  categorias: 'Criar e editar categorias do cartão faz parte do plano Pro.',
  casal: 'Dois perfis e a visão do casal fazem parte do plano Duo.',
};
