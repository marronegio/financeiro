// Fonte da verdade dos preços NO SERVIDOR. O frontend só manda a chave do
// plano; o valor cobrado sai daqui. Espelha src/plans.js — ao mexer em um,
// mexa no outro.
//
// Importado por:
//   * asaas-create-subscription — cobra este valor em assinaturas NOVAS;
//   * admin (ação asaas_price_sync) — realinha as assinaturas JÁ existentes.
// Sem esse módulo compartilhado, baixar um preço acertaria só quem assina
// depois, e as duas tabelas divergiriam em silêncio.

export type AsaasCycle = 'MONTHLY' | 'YEARLY'

export type PlanConfig = {
  tier: 'solo' | 'duo'
  value: number
  cycle: AsaasCycle
  label: string
}

export const PLAN_CONFIG: Record<string, PlanConfig> = {
  'solo-monthly': { tier: 'solo', value: 17.9, cycle: 'MONTHLY', label: 'DinPrev Solo (Mensal)' },
  'solo-annual': { tier: 'solo', value: 142.8, cycle: 'YEARLY', label: 'DinPrev Solo (Anual)' },
  'duo-monthly': { tier: 'duo', value: 29.9, cycle: 'MONTHLY', label: 'DinPrev Duo (Mensal)' },
  'duo-annual': { tier: 'duo', value: 238.8, cycle: 'YEARLY', label: 'DinPrev Duo (Anual)' },
}

// Reconstrói a chave do plano a partir do que está gravado no perfil.
// plan_cycle pode faltar em contas antigas — nesse caso assumimos mensal, que é
// o padrão do gate de créditos de IA (_shared/aiCredits.ts).
export function planKeyOf(plan: string | null, planCycle: string | null): string | null {
  const tier = plan === 'duo' ? 'duo' : plan === 'solo' ? 'solo' : null
  if (!tier) return null // 'free' e valores desconhecidos não têm cobrança
  return `${tier}-${planCycle === 'annual' ? 'annual' : 'monthly'}`
}
