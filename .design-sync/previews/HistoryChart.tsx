import React from 'react';
import { HistoryChart } from 'dinprev';

// Gráfico de evolução mensal (meses fechados no histórico).

const HIST = [
  { periodo: '2025-12', salario: 4500, rendaExtra: 300, gasto: 2900, cartao: 1450, guardado: 600 },
  { periodo: '2026-01', salario: 4500, rendaExtra: 0, gasto: 3200, cartao: 1780, guardado: 500 },
  { periodo: '2026-02', salario: 4500, rendaExtra: 450, gasto: 2750, cartao: 1310, guardado: 800 },
  { periodo: '2026-03', salario: 4800, rendaExtra: 0, gasto: 3050, cartao: 1620, guardado: 700 },
  { periodo: '2026-04', salario: 4800, rendaExtra: 620, gasto: 2980, cartao: 1495, guardado: 900 },
  { periodo: '2026-05', salario: 4800, rendaExtra: 150, gasto: 3300, cartao: 1875, guardado: 650 },
  { periodo: '2026-06', salario: 5200, rendaExtra: 0, gasto: 3100, cartao: 1540, guardado: 1000 },
];

export const SeisMeses = () => <HistoryChart historico={HIST} />;

export const PrimeiroMesFechado = () => <HistoryChart historico={HIST.slice(-1)} />;

export const SemHistorico = () => <HistoryChart historico={[]} />;
