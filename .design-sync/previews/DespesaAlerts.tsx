import React from 'react';
import { DespesaAlerts } from 'dinprev';

// Pilha de toasts de vencimento (fixed bottom-right — contida pela moldura).
// Os dias de vencimento são derivados de "hoje" para os alertas dispararem
// (a regra é exatamente 3, 1 ou 0 dias até o vencimento).

const dia = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return String(d.getDate());
};

const Box =({ children }: { children: React.ReactNode }) => (
  <div style={{ position: 'relative', height: 360, transform: 'translateZ(0)', overflow: 'hidden' }}>
    {children}
  </div>
);

export const TresAvisos = () => (
  <Box>
    <DespesaAlerts
      despesas={[
        { nome: 'Aluguel', valor: '1.450,00', venc: dia(0) },
        { nome: 'Internet', valor: '119,90', venc: dia(1) },
        { nome: 'Energia', valor: '218,37', venc: dia(3) },
      ]}
      onPaid={() => {}}
    />
  </Box>
);

export const VenceHoje = () => (
  <Box>
    <DespesaAlerts
      despesas={[{ nome: 'Cartão de crédito', valor: '1.875,00', venc: dia(0) }]}
      onPaid={() => {}}
    />
  </Box>
);
