import React, { useEffect, useRef, useState } from 'react';
import { BRL } from '../money.js';

/* Anima um número de 0 até `target` quando `run` fica true (ease-out cúbico). */
function useCountUp(target, run, dur = 950) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) {
      setV(target);
      return;
    }
    let raf;
    let start;
    const tick = (t) => {
      if (start == null) start = t;
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, dur]);
  return v;
}

const Dot = ({ c }) => <span className="dot" style={{ background: c }} />;

/* ── Planejamento: card "Resultado do mês" (também usado no hero) ── */
export function PlanMock() {
  const sobra = useCountUp(821.41, true);
  const W = (v) => `${(v / 5000) * 100}%`;
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Resultado do mês</span>
      </div>

      <div className="hero pos">
        <div className="lo-label">Sobra disponível</div>
        <div className="lo-value">{BRL(sobra)}</div>
        <div className="lo-note">depois de gastos e do que você guarda</div>
      </div>

      <div className="legend">
        <div className="item"><Dot c="var(--expense)" /> Gastos</div>
        <div className="item"><Dot c="var(--savings)" /> Guardado</div>
        <div className="item"><Dot c="var(--credit)" /> Crédito</div>
        <div className="item"><Dot c="var(--debit)" /> Débito</div>
      </div>

      <div className="bar">
        <span className="lp-grow" style={{ background: 'var(--expense)', width: W(3678.59) }} />
        <span className="lp-grow" style={{ background: 'var(--savings)', width: W(500) }} />
        <span className="lp-grow" style={{ background: 'var(--credit)', width: W(410.7) }} />
        <span className="lp-grow" style={{ background: 'var(--debit)', width: W(410.7) }} />
      </div>

      <div>
        <div className="summary-line">
          <span className="lbl"><Dot c="var(--ink)" /> Salário</span>
          <span className="amt">{BRL(5000)}</span>
        </div>
        <div className="summary-line minus">
          <span className="lbl"><Dot c="var(--expense)" /> Total de gastos</span>
          <span className="amt">{BRL(3678.59)}</span>
        </div>
        <div className="summary-line minus">
          <span className="lbl"><Dot c="var(--savings)" /> Guardado</span>
          <span className="amt">{BRL(500)}</span>
        </div>
        <div className="summary-line total">
          <span className="lbl"><strong>Sobra</strong></span>
          <span className="amt" style={{ color: 'var(--positive)' }}>{BRL(821.41)}</span>
        </div>
      </div>

      <div className="split-cards">
        <div className="split-card credit">
          <div className="sc-tag"><span>Crédito</span><span className="sc-pct">50%</span></div>
          <div className="sc-value">{BRL(410.7)}</div>
          <div className="sc-desc">limite pra gastar na fatura</div>
        </div>
        <div className="split-card debit">
          <div className="sc-tag"><span>Débito</span><span className="sc-pct">50%</span></div>
          <div className="sc-value">{BRL(410.7)}</div>
          <div className="sc-desc">disponível na conta</div>
        </div>
      </div>
    </div>
  );
}

/* ── Assinaturas ── */
const ASSIN = [
  ['Spotify', '31,90'],
  ['Meli+', '19,90'],
  ['Turbo Cloud', '49,90'],
  ['Clube iFood', '7,95'],
];
function AssinaturasMock() {
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Assinaturas</span>
        <span className="card-total">R$ 228,05</span>
      </div>
      {ASSIN.map(([nome, val], i) => (
        <div className="row lp-rowin" key={nome} style={{ animationDelay: `${i * 70}ms` }}>
          <div className="name-wrap">
            <input className="name-input" type="text" value={nome} readOnly />
          </div>
          <div className="val-wrap">
            <span className="prefix">R$</span>
            <input type="text" value={val} readOnly />
          </div>
          <button className="del-btn" tabIndex={-1}>×</button>
        </div>
      ))}
      <button className="add-btn" tabIndex={-1}>＋ Adicionar assinatura</button>
      <p className="hint">
        Serviços recorrentes — streaming, apps, academia. Somadas às despesas, compõem seus gastos
        do mês.
      </p>
    </div>
  );
}

/* ── Despesas fixas ── */
const DESP = [
  ['Aluguel', '1.450,00', '05'],
  ['Energia', '189,90', '10'],
  ['Internet', '119,90', '15'],
  ['Escola', '680,00', '08'],
];
function DespesasMock() {
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Despesas fixas</span>
        <span className="card-total">R$ 2.439,80</span>
      </div>
      {DESP.map(([nome, val, dia], i) => (
        <div className="row has-venc lp-rowin" key={nome} style={{ animationDelay: `${i * 70}ms` }}>
          <div className="name-wrap">
            <input className="name-input" type="text" value={nome} readOnly />
          </div>
          <div className="venc-wrap">
            <span className="prefix">dia</span>
            <input type="text" value={dia} readOnly />
          </div>
          <div className="val-wrap">
            <span className="prefix">R$</span>
            <input type="text" value={val} readOnly />
          </div>
          <button className="del-btn" tabIndex={-1}>×</button>
        </div>
      ))}
      <button className="add-btn" tabIndex={-1}>＋ Adicionar despesa</button>
      <p className="hint">
        Tudo que sai todo mês. O DinPrev te avisa por e-mail um dia antes de cada vencimento.
      </p>
    </div>
  );
}

/* ── Cartão: resumo da fatura ── */
function CartaoMock() {
  const fatura = useCountUp(2269.29, true);
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Resumo da fatura</span>
      </div>
      <div className="hero">
        <div className="lo-label">Total da fatura</div>
        <div className="lo-value">{BRL(fatura)}</div>
        <div className="lo-note">compras no cartão + parcelas do mês</div>
      </div>
      <div>
        <div className="summary-line">
          <span className="lbl"><Dot c="var(--credit)" /> Gasto no cartão</span>
          <span className="amt">{BRL(1177.57)}</span>
        </div>
        <div className="summary-line">
          <span className="lbl"><Dot c="var(--debit)" /> Parcelas do mês</span>
          <span className="amt">{BRL(1091.72)}</span>
        </div>
        <div className="summary-line total">
          <span className="lbl"><strong>Total da fatura</strong></span>
          <span className="amt">{BRL(2269.29)}</span>
        </div>
      </div>
      <div className="lp-cat-chips">
        <span className="lp-cat-chip"><Dot c="#e0564c" /> Alimentação · R$ 486</span>
        <span className="lp-cat-chip"><Dot c="#3a6ea5" /> Transporte · R$ 312</span>
        <span className="lp-cat-chip"><Dot c="#9b6bff" /> Lazer · R$ 259</span>
        <span className="lp-cat-chip"><Dot c="#635bff" /> Compras · R$ 120</span>
      </div>
    </div>
  );
}

/* ── Parcelamentos ── */
const PARC = [
  { nome: 'Curso Profissionalizante', total: '616,80', parc: 12, pagas: 3, mensal: '51,40', falta: '462,60' },
  { nome: 'Sapato Casamento', total: '339,99', parc: 4, pagas: 2, mensal: '85,00', falta: '170,00' },
  { nome: 'Estante Sala', total: '692,56', parc: 11, pagas: 4, mensal: '62,96', falta: '440,72' },
];
function ParcelamentosMock() {
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Compras parceladas</span>
        <span className="card-total">R$ 1.091,72 /mês</span>
      </div>
      {PARC.map((p, i) => (
        <div className="pcard lp-rowin" key={p.nome} style={{ animationDelay: `${i * 90}ms` }}>
          <div className="pcard-top">
            <div className="name-wrap">
              <input className="name-input" type="text" value={p.nome} readOnly />
            </div>
            <button className="del-btn" tabIndex={-1}>×</button>
          </div>
          <div className="pcard-fields">
            <label className="pf">
              <span className="pf-l">Valor total</span>
              <div className="val-wrap"><span className="prefix">R$</span><input type="text" value={p.total} readOnly /></div>
            </label>
            <label className="pf">
              <span className="pf-l">Nº parcelas</span>
              <div className="val-wrap"><input type="text" value={p.parc} readOnly /></div>
            </label>
            <label className="pf">
              <span className="pf-l">Já pagas</span>
              <div className="val-wrap"><input type="text" value={p.pagas} readOnly /></div>
            </label>
          </div>
          <div className="pcard-meta">
            <div className="pbar"><span className="lp-grow" style={{ width: `${(p.pagas / p.parc) * 100}%` }} /></div>
            <div className="pmeta-text">
              {p.pagas} de {p.parc} pagas · <b>R$ {p.mensal}</b>/mês · faltam R$ {p.falta}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Histórico: gráfico de evolução (SVG com desenho animado) ── */
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun'];
const GUARDADO = [320, 540, 470, 690, 780, 900];
const CARTAO = [1500, 1180, 1620, 1240, 1380, 1177];
function HistoricoMock() {
  const W = 380, H = 170, padL = 44, padR = 14, padT = 14, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = 1700;
  const x = (i) => padL + (i / (MESES.length - 1)) * plotW;
  const y = (v) => padT + (1 - v / max) * plotH;
  const pts = (arr) => arr.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const grid = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Evolução</span>
        <div className="seg">
          <button tabIndex={-1}>3m</button>
          <button className="active" tabIndex={-1}>6m</button>
          <button tabIndex={-1}>12m</button>
        </div>
      </div>
      <div className="chart-legend">
        <span className="ci"><span className="dot" style={{ background: 'var(--positive)' }} /> Guardado</span>
        <span className="ci"><span className="dot" style={{ background: 'var(--negative)' }} /> Gasto no cartão</span>
      </div>
      <svg className="lp-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolução mensal">
        {grid.map((g, k) => (
          <line key={k} x1={padL} x2={W - padR} y1={padT + g * plotH} y2={padT + g * plotH} className="lp-chart-grid" />
        ))}
        {MESES.map((m, i) => (
          <text key={m} x={x(i)} y={H - 9} textAnchor="middle" className="lp-chart-axis">{m}</text>
        ))}
        <polyline points={pts(CARTAO)} className="lp-chart-line lp-chart-draw" style={{ stroke: 'var(--negative)' }} />
        <polyline points={pts(GUARDADO)} className="lp-chart-line lp-chart-draw2" style={{ stroke: 'var(--positive)' }} />
        {GUARDADO.map((v, i) => <circle key={'g' + i} cx={x(i)} cy={y(v)} r="3.2" style={{ fill: 'var(--positive)' }} />)}
        {CARTAO.map((v, i) => <circle key={'c' + i} cx={x(i)} cy={y(v)} r="3.2" style={{ fill: 'var(--negative)' }} />)}
      </svg>
    </div>
  );
}

/* ── Assistente com IA: mock de conversa (texto, voz e imagem) ── */
const WAVE = [0.4, 0.7, 0.5, 0.9, 0.6, 0.85, 0.45, 0.7, 0.55, 0.85, 0.5, 0.75, 0.6, 0.4, 0.8, 0.5, 0.65, 0.9, 0.55, 0.7];
export function AiChatMock() {
  return (
    <div className="lp-ai-chat">
      <div className="lp-ai-head">
        <span className="lp-ai-head-title">✦ Assistente</span>
      </div>
      <div className="lp-ai-msgs">
        <div className="lp-ai-msg user lp-rowin">
          <div className="lp-ai-voice">
            <span className="lp-ai-voice-btn">▶</span>
            <span className="lp-ai-wave">
              {WAVE.map((h, i) => (
                <i key={i} style={{ height: `${h * 100}%`, opacity: i < 8 ? 1 : 0.45 }} />
              ))}
            </span>
            <span className="lp-ai-time">0:06</span>
          </div>
          <span className="lp-ai-cap">"Gastei 60 no cinema e 40 na americanas"</span>
        </div>

        <div className="lp-ai-msg bot lp-rowin" style={{ animationDelay: '.15s' }}>
          Lancei <b>R$60</b> no cartão em <b>Lazer</b> 🎬 e <b>R$40</b> em <b>Compras</b> 🛍️. Sua
          fatura foi pra <b>R$2.369,29</b>.
        </div>

        <div className="lp-ai-msg user lp-rowin" style={{ animationDelay: '.3s' }}>
          <span className="lp-ai-receipt" aria-hidden="true">
            <i /><i /><i /><i />
          </span>
          <span className="lp-ai-cap">📷 Boleto da academia</span>
        </div>

        <div className="lp-ai-msg bot lp-rowin" style={{ animationDelay: '.45s' }}>
          Boleto de <b>R$129,90</b> da academia adicionado nas <b>assinaturas</b> ✅
        </div>

        <div className="lp-ai-msg user lp-rowin" style={{ animationDelay: '.6s' }}>
          quanto posso gastar esse mês?
        </div>

        <div className="lp-ai-msg bot lp-rowin" style={{ animationDelay: '.75s' }}>
          Sua sobra tá em <b>R$821,41</b>. Dá pra usar até <b>R$410</b> no crédito sem apertar 😉
        </div>
      </div>
      <div className="lp-ai-inputbar">
        <span className="lp-ai-input">Pergunte ou lance um gasto…</span>
        <span className="lp-ai-btn lp-ai-mic">🎙</span>
        <span className="lp-ai-btn lp-ai-send">➤</span>
      </div>
    </div>
  );
}

const TABS = [
  { id: 'plan', label: 'Planejamento', ico: '◷', render: () => <PlanMock /> },
  { id: 'desp', label: 'Despesas', ico: '⊟', render: () => <DespesasMock /> },
  { id: 'assin', label: 'Assinaturas', ico: '↻', render: () => <AssinaturasMock /> },
  { id: 'cartao', label: 'Cartão', ico: '▣', render: () => <CartaoMock /> },
  { id: 'parc', label: 'Parcelamentos', ico: '≣', render: () => <ParcelamentosMock /> },
  { id: 'hist', label: 'Histórico', ico: '◴', render: () => <HistoricoMock /> },
  { id: 'ia', label: 'Assistente IA', ico: '✦', render: () => <AiChatMock /> },
];

export default function LandingDemo() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (paused) return;
    timer.current = setTimeout(() => setActive((a) => (a + 1) % TABS.length), 4200);
    return () => clearTimeout(timer.current);
  }, [active, paused]);

  return (
    <div
      className="lp-window reveal"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="lp-window-bar">
        <span className="lp-window-dots"><i /><i /><i /></span>
        <span className="lp-window-title">DinPrev — {TABS[active].label}</span>
      </div>

      <div className="lp-demo-tabs">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            className={'lp-demo-tab' + (i === active ? ' active' : '')}
            onClick={() => setActive(i)}
          >
            <span className="lp-demo-tab-ico">{t.ico}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="lp-demo-body">
        <div className="lp-demo-stage" key={active}>
          {TABS[active].render()}
        </div>
      </div>
    </div>
  );
}
