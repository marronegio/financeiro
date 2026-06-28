import React, { useState } from 'react';
import { LineChart } from '@mui/x-charts/LineChart';
import { BRL } from '../money.js';

// Cores do tema (iguais às vars --positive / --negative).
const GREEN = '#0e9f6e';
const RED = '#e0564c';
const BLUE = '#3b82f6'; // sobrou no mês
const LIGHT_GREEN = '#86cfa6'; // renda extra do mês

// Rótulo curto pro eixo Y: R$ 1,2k / R$ 350 / -R$ 1k
function compact(n) {
  const a = Math.abs(n);
  if (a >= 1000) {
    const v = (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    return `R$ ${v}k`;
  }
  return `R$ ${Math.round(n)}`;
}

// 'YYYY-MM' → 'jun/26'
function shortLabel(p) {
  if (!p) return '';
  const [y, m] = p.split('-').map(Number);
  return new Date(y, m - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    .replace('.', '');
}

export default function HistoryChart({ historico }) {
  const [range, setRange] = useState(6);

  const data = (historico || []).slice(-range);
  const n = data.length;
  const labels = data.map((h) => shortLabel(h.periodo));
  const guardado = data.map((h) => Number(h.guardado) || 0);
  const cartao = data.map((h) => Number(h.cartao) || 0);
  const rendaExtra = data.map((h) => Number(h.rendaExtra) || 0);
  // Sobrou = o que ficou livre depois de pagar tudo e guardar (renda − gasto − guardado).
  const sobrou = data.map(
    (h) =>
      (Number(h.salario) || 0) +
      (Number(h.rendaExtra) || 0) -
      (Number(h.gasto) || 0) -
      (Number(h.guardado) || 0)
  );

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Evolução</span>
        <div className="seg">
          {[3, 6, 12].map((r) => (
            <button
              key={r}
              className={range === r ? 'active' : ''}
              onClick={() => setRange(r)}
            >
              {r}m
            </button>
          ))}
        </div>
      </div>

      <div className="chart-legend">
        <span className="ci">
          <span className="dot" style={{ background: GREEN }} /> Guardado
        </span>
        <span className="ci">
          <span className="dot" style={{ background: RED }} /> Gasto no cartão
        </span>
        <span className="ci">
          <span className="dot" style={{ background: BLUE }} /> Sobrou
        </span>
        <span className="ci">
          <span className="dot" style={{ background: LIGHT_GREEN }} /> Renda extra
        </span>
      </div>

      {n === 0 ? (
        <p className="hint hist-empty">
          Sem meses fechados ainda. O gráfico aparece assim que houver histórico.
        </p>
      ) : (
        <LineChart
          height={260}
          margin={{ left: 8, right: 12, top: 12, bottom: 24 }}
          xAxis={[{ scaleType: 'point', data: labels }]}
          yAxis={[{ width: 56, valueFormatter: compact }]}
          series={[
            {
              data: guardado,
              label: 'Guardado',
              color: GREEN,
              curve: 'linear',
              valueFormatter: (v) => (v == null ? '' : BRL(v)),
            },
            {
              data: cartao,
              label: 'Gasto no cartão',
              color: RED,
              curve: 'linear',
              valueFormatter: (v) => (v == null ? '' : BRL(v)),
            },
            {
              data: sobrou,
              label: 'Sobrou',
              color: BLUE,
              curve: 'linear',
              valueFormatter: (v) => (v == null ? '' : BRL(v)),
            },
            {
              data: rendaExtra,
              label: 'Renda extra',
              color: LIGHT_GREEN,
              curve: 'linear',
              valueFormatter: (v) => (v == null ? '' : BRL(v)),
            },
          ]}
          grid={{ horizontal: true }}
          hideLegend
        />
      )}
    </div>
  );
}
