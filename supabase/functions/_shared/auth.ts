// Pedaços de autenticação compartilhados pelas Edge Functions.

// Extrai o user id (claim `sub`) do JWT. A plataforma já validou a assinatura
// antes de o código rodar (verify_jwt = true no config.toml), então aqui basta
// decodificar o payload — sem revalidar nada.
export function userIdFromRequest(req: Request): string | null {
  try {
    const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    const b64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded))
    return (payload.sub as string) || null
  } catch {
    return null
  }
}

// Assinatura vigente? Espelha src/hooks/useSubscription.js; ao mexer em um,
// confira o outro. O `admin_override` do painel administrativo manda em tudo.
export function hasPaidAccess(profile: {
  subscription_status?: string | null
  access_until?: string | null
  admin_override?: string | null
} | null | undefined): boolean {
  const trialing = profile?.subscription_status === 'trialing'
  const notExpired = !profile?.access_until ||
    new Date(profile.access_until).getTime() > Date.now()
  const paidOk = (profile?.subscription_status === 'active' || trialing) && notExpired
  if (profile?.admin_override === 'active') return true
  if (profile?.admin_override === 'inactive') return false
  return paidOk
}
