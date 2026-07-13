import React from 'react';
import { ParcelasProjecaoChart } from 'dinprev';

// Projeção do total de parcelas na fatura, mês a mês.

const PARCELAMENTOS = [
  { nome: 'Notebook', total: '4.800,00', parcelas: '12', pagas: '5' },
  { nome: 'Celular', total: '2.400,00', parcelas: '10', pagas: '7' },
  { nome: 'Sofá', total: '1.890,00', parcelas: '6', pagas: '2' },
];

export const ProjecaoAtiva = () => <ParcelasProjecaoChart parcelamentos={PARCELAMENTOS} />;

// Parcelas via Pix não passam pela fatura — com SÓ itens Pix o gráfico mostra
// o estado vazio, demonstrando a exclusão.
export const SoParcelasViaPix = () => (
  <ParcelasProjecaoChart
    parcelamentos={[
      { nome: 'Reembolso ao irmão', total: '1.200,00', parcelas: '12', pagas: '1', pix: true },
    ]}
  />
);

export const SemParcelamentos = () => <ParcelasProjecaoChart parcelamentos={[]} />;
