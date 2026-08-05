// Requisitos de senha nova — mesma regra nos três lugares onde o usuário
// escolhe uma senha (cadastro, redefinição por e-mail e troca em
// Configurações), então a política vive aqui uma vez só. Login não passa por
// aqui: contas antigas podem ter senhas que não cumprem os requisitos atuais,
// e a senha de quem já tem conta não deve ser barrada na hora de entrar.

export const PASSWORD_MIN_LENGTH = 6;

export const PASSWORD_RULES = [
  { id: 'length', label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`, test: (v) => v.length >= PASSWORD_MIN_LENGTH },
  { id: 'upper', label: 'Uma letra maiúscula', test: (v) => /[A-Z]/.test(v) },
  { id: 'lower', label: 'Uma letra minúscula', test: (v) => /[a-z]/.test(v) },
  { id: 'number', label: 'Um número', test: (v) => /[0-9]/.test(v) },
  { id: 'special', label: 'Um caractere especial', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

// Devolve cada regra com o resultado para a senha atual — o que o checklist
// em tempo real renderiza.
export function passwordChecks(password) {
  const pw = password || '';
  return PASSWORD_RULES.map(({ id, label, test }) => ({ id, label, ok: test(pw) }));
}

export function isStrongPassword(password) {
  return passwordChecks(password).every((c) => c.ok);
}
