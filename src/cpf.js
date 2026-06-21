// Utilitários de CPF: normalização, validação dos dígitos verificadores e máscara
// de exibição (000.000.000-00). A validação confere apenas a consistência do
// número (checksum), não se ele existe na Receita.

export const onlyDigits = (s = '') => s.replace(/\D/g, '');

export function isValidCPF(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // rejeita 000.. 111.. etc.

  const digit = (sliceLen) => {
    let sum = 0;
    for (let i = 0; i < sliceLen; i++) {
      sum += parseInt(cpf[i], 10) * (sliceLen + 1 - i);
    }
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };

  return digit(9) === parseInt(cpf[9], 10) && digit(10) === parseInt(cpf[10], 10);
}

export function formatCPF(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
}
