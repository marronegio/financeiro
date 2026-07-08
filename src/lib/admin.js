// Quem enxerga o painel administrativo no frontend. Isto é só cosmético (mostrar
// ou não o link/rota): a autoridade de verdade fica na Edge Function `admin`, que
// reconfere o e-mail contra o secret ADMIN_EMAIL antes de tocar em qualquer dado.
//
// Configure em .env (mesma lista de e-mails do secret, separados por vírgula):
//   VITE_ADMIN_EMAIL=voce@exemplo.com
// Sem a variável, cai no e-mail padrão abaixo.
const RAW = import.meta.env.VITE_ADMIN_EMAIL || 'giovannemarrone@gmail.com';

const ADMINS = RAW.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

export function isAdmin(user) {
  const email = (user?.email || '').toLowerCase();
  return Boolean(email) && ADMINS.includes(email);
}
