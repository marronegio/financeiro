import React from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { BRL, computeParcela } from '../money.js';
import { useTheme } from '../theme.js';

// Cores iguais às vars --debit de cada tema (o MUI não lê CSS vars).
const DEBIT_LIGHT = '#3a6ea5';
const DEBIT_DARK = '#6b9bd6';

// Rótulo curto pro eixo Y: R$ 1,2k / R$ 350
function compact(n) {
  const a = Math.abs(n);
  if (a >= 1000) {
    const v = (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    return `R$ ${v}k`;
  }
  return `R$ ${Math.round(n)}`;
}

// Data → 'jul/26'
const shortLabel = (d) =>
  d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');

const MAX_MESES = 12;

// Projeção do total de parcelas na fatura de cada mês, do mês atual até o fim
// dos parcelamentos ativos (limitado a 12 meses). No mês k entram os
// parcelamentos que ainda têm mais de k parcelas restantes. Parcelas via Pix
// ficam fora: não passam pela fatura do cartão.
export default function ParcelasProjecaoChart({ parcelamentos }) {
  const { theme } = useTheme();
  const ativos = (parcelamentos || [])
    .filter((it) => !it.pix)
    .map(computeParcela)
    .filter((p) => p.parc > 0 && !p.done);
  const maxRestantes = ativos.reduce((m, p) => Math.max(m, p.restantes), 0);
  const meses = Math.min(maxRestantes, MAX_MESES);

  const hoje = new Date();
  const labels = [];
  const valores = [];
  for (let k = 0; k < meses; k++) {
    labels.push(shortLabel(new Date(hoje.getFullYear(), hoje.getMonth() + k, 1)));
    valores.push(ativos.reduce((s, p) => s + (p.restantes > k ? p.mensal : 0), 0));
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Projeção das parcelas</span>
        {meses > 0 && <span className="card-total">até {labels[meses - 1]}</span>}
      </div>

      {meses === 0 ? (
        <p className="hint">
          Sem parcelamentos ativos no cartão. A projeção aparece assim que houver uma compra
          parcelada em aberto na fatura.
        </p>
      ) : (
        <BarChart
          height={240}
          margin={{ left: 8, right: 12, top: 12, bottom: 24 }}
          xAxis={[{ scaleType: 'band', data: labels }]}
          yAxis={[{ width: 56, valueFormatter: compact }]}
          series={[
            {
              data: valores,
              label: 'Parcelas na fatura',
              color: theme === 'dark' ? DEBIT_DARK : DEBIT_LIGHT,
              valueFormatter: (v) => (v == null ? '' : BRL(v)),
            },
          ]}
          grid={{ horizontal: true }}
          borderRadius={4}
          hideLegend
        />
      )}

      {meses > 0 && (
        <p className="hint">
          Quanto de parcelas entra na fatura no início de cada mês, considerando as compras atuais
          no cartão (parcelas via Pix ficam de fora).
          {maxRestantes > MAX_MESES ? ' Mostrando os próximos 12 meses.' : ''}
        </p>
      )}
    </div>
  );
}
