import React, { useEffect, useMemo, useState } from 'react';
import { BRL, compute, toNumber } from '../money.js';
import MoneyField from './MoneyField.jsx';

const initials = (name) => (name || '?').trim().slice(0, 2).toUpperCase();

// Só o primeiro nome: nomes completos não cabem nas colunas da tabela.
const firstName = (name) => (name || '').trim().split(/\s+/)[0] || '?';

// Nome normalizado para casar assinaturas iguais nos dois perfis
// ("Netflix " ≡ "netflix" ≡ "Nétflix").
const normName = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    // remove acentos — a faixa de combinantes é escrita escapada porque os
    // caracteres literais viram regex inválida se o JS for lido sem UTF-8
    .replace(/[\u0300-\u036f]/g, '');

function Avatar({ profile }) {
  const src = profile?.data?.avatar;
  return (
    <span className={'casal-av' + (src ? ' has-photo' : '')}>
      {src ? <img src={src} alt="" /> : initials(profile?.name)}
    </span>
  );
}

// Visão macro do plano Duo: soma e compara os dois perfis. Só leitura — os
// números vêm do mesmo compute() usado no Planejamento de cada perfil.
export default function CasalPanel({ profiles, active, onOpenProfiles, onReload }) {
  // O outro perfil pode ter sido editado em outro aparelho: atualiza ao abrir.
  useEffect(() => { onReload?.(); }, [onReload]);

  const main = profiles?.main;
  const partner = profiles?.partner;

  // Divisão justa de uma conta: valor digitado + modo de rateio.
  const [contaValor, setContaValor] = useState('');
  const [rateio, setRateio] = useState('prop'); // 'prop' | 'meio'

  const cA = useMemo(() => (main ? compute(main.data) : null), [main]);
  const cB = useMemo(() => (partner ? compute(partner.data) : null), [partner]);

  if (!partner) {
    return (
      <div className="panel">
        <div className="card casal-empty">
          <p>
            A visão do casal soma renda, gastos e economia dos dois perfis do plano Duo —
            mas o segundo perfil ainda não foi criado.
          </p>
          <button className="pg-btn" onClick={onOpenProfiles}>
            Criar o perfil do seu par
          </button>
        </div>
      </div>
    );
  }

  const shares = (p) => p.data.compartilharCasal !== false;
  const paused = [
    ...(shares(main) ? [] : ['main']),
    ...(shares(partner) ? [] : ['partner']),
  ];

  // A visão só existe com o aceite DOS DOIS: se um pausar, ninguém vê o outro
  // (evita o assimétrico "escondo os meus, mas vejo os seus").
  if (paused.length > 0) {
    return (
      <div className="panel">
        <div className="card casal-empty">
          <p>
            {paused.includes(active)
              ? 'Você pausou o compartilhamento dos seus dados, então a visão do casal está desativada para os dois.'
              : `${(paused[0] === 'main' ? main : partner).name} pausou o compartilhamento, então a visão do casal está desativada por enquanto.`}
          </p>
          <p className="casal-note">
            {paused.includes(active)
              ? 'Para reativar, vá em Configurações → “Visão do casal”.'
              : 'Cada perfil controla o próprio compartilhamento em Configurações.'}
          </p>
        </div>
      </div>
    );
  }

  const rendaA = cA.salario + cA.rendaExtraNoPlano;
  const rendaB = cB.salario + cB.rendaExtraNoPlano;
  const rendaCasal = rendaA + rendaB;
  const gastosCasal = cA.gastos + cB.gastos;
  const guardarCasal = cA.guardar + cB.guardar;
  const sobraCasal = cA.sobra + cB.sobra;

  // % da renda já comprometida (gastos + o que guarda) de cada um.
  const compromet = (c, renda) =>
    renda > 0 ? Math.round(((c.gastos + c.guardar) / renda) * 100) : null;
  const compA = compromet(cA, rendaA);
  const compB = compromet(cB, rendaB);

  // Divisão justa: proporcional à renda, ou meio a meio.
  const conta = toNumber(contaValor);
  const shareA = rateio === 'meio' || rendaCasal <= 0 ? 0.5 : rendaA / rendaCasal;
  const pctShare = (f) => Math.round(f * 100);

  // Assinaturas com o mesmo nome nos dois perfis — candidatas a plano família.
  const dupes = (() => {
    const mapB = new Map();
    for (const it of partner.data.assinaturas || []) {
      const k = normName(it.nome);
      if (k && toNumber(it.valor) > 0) mapB.set(k, it);
    }
    const out = [];
    for (const it of main.data.assinaturas || []) {
      const k = normName(it.nome);
      const other = k && mapB.get(k);
      if (other && toNumber(it.valor) > 0) {
        out.push({ nome: it.nome.trim(), total: toNumber(it.valor) + toNumber(other.valor) });
      }
    }
    return out;
  })();

  const row = (label, a, b, opts = {}) => (
    <div className={'casal-row' + (opts.total ? ' total' : '')}>
      <span className="casal-row-lbl">{label}</span>
      <span className="casal-cell">{BRL(a)}</span>
      <span className="casal-cell">{BRL(b)}</span>
      <span className="casal-cell juntos" style={opts.color ? { color: opts.color(a + b) } : undefined}>
        {BRL(a + b)}
      </span>
    </div>
  );

  const sobraColor = (v) => (v >= 0 ? 'var(--positive)' : 'var(--negative)');

  return (
    <div className="panel">
      {/* Placar do casal */}
      <div className="casal-stats">
        <div className="card casal-stat">
          <div className="cs-label">Renda do casal</div>
          <div className="cs-value">{BRL(rendaCasal)}</div>
          <div className="cs-desc">salários + renda extra do mês</div>
        </div>
        <div className="card casal-stat">
          <div className="cs-label">Gastos do casal</div>
          <div className="cs-value" style={{ color: 'var(--expense)' }}>{BRL(gastosCasal)}</div>
          <div className="cs-desc">fixas, assinaturas, cartão e parcelas</div>
        </div>
        <div className="card casal-stat">
          <div className="cs-label">Guardando por mês</div>
          <div className="cs-value" style={{ color: 'var(--savings)' }}>{BRL(guardarCasal)}</div>
          <div className="cs-desc">a meta de economia dos dois somada</div>
        </div>
        <div className="card casal-stat">
          <div className="cs-label">Sobra do casal</div>
          <div className="cs-value" style={{ color: sobraColor(sobraCasal) }}>{BRL(sobraCasal)}</div>
          <div className="cs-desc">
            {sobraCasal >= 0 ? 'livre depois de tudo' : 'vocês estão no vermelho'}
          </div>
        </div>
      </div>

      <div className="grid">
        <div>
          {/* Lado a lado */}
          <div className="card">
            <div className="card-head">
              <span className="card-title">Lado a lado</span>
            </div>
            <div className="casal-table">
              <div className="casal-row head">
                <span className="casal-row-lbl" />
                <span className="casal-cell casal-who"><Avatar profile={main} />{firstName(main.name)}</span>
                <span className="casal-cell casal-who"><Avatar profile={partner} />{firstName(partner.name)}</span>
                <span className="casal-cell juntos">Juntos</span>
              </div>
              {row('Salário', cA.salario, cB.salario)}
              {(cA.rendaExtraNoPlano > 0 || cB.rendaExtraNoPlano > 0) &&
                row('Renda extra', cA.rendaExtraNoPlano, cB.rendaExtraNoPlano)}
              {row('Despesas fixas', cA.totDesp, cB.totDesp)}
              {row('Assinaturas', cA.totAss, cB.totAss)}
              {(cA.totDoacoes > 0 || cB.totDoacoes > 0) &&
                row('Doações', cA.totDoacoes, cB.totDoacoes)}
              {row('Cartão', cA.totCartao, cB.totCartao)}
              {(cA.parcelaMensal > 0 || cB.parcelaMensal > 0) &&
                row('Parcelas do mês', cA.parcelaMensal, cB.parcelaMensal)}
              {row('Total de gastos', cA.gastos, cB.gastos)}
              {row('Guardando', cA.guardar, cB.guardar)}
              {row('Sobra', cA.sobra, cB.sobra, { total: true, color: sobraColor })}
            </div>
          </div>

          {/* Comprometimento da renda */}
          <div className="card">
            <div className="card-head">
              <span className="card-title">Comprometimento da renda</span>
            </div>
            {[[main, cA, rendaA, compA], [partner, cB, rendaB, compB]].map(
              ([p, c, renda, comp]) => (
                <div className="casal-comp" key={p === main ? 'main' : 'partner'}>
                  <div className="casal-comp-head">
                    <span className="casal-who"><Avatar profile={p} />{firstName(p.name)}</span>
                    <span className="casal-comp-pct">
                      {comp === null ? 'sem renda informada' : `${comp}% comprometido`}
                    </span>
                  </div>
                  <div className="bar">
                    <span
                      style={{
                        background: comp !== null && comp > 100 ? 'var(--negative)' : 'var(--expense)',
                        width: Math.min(100, comp ?? 0) + '%',
                      }}
                    />
                  </div>
                </div>
              )
            )}
            <p className="casal-note">
              Quanto dos ganhos de cada um já está tomado por gastos e pela meta de guardar.
            </p>
          </div>
        </div>

        <div className="sticky">
          {/* Divisão justa */}
          <div className="card">
            <div className="card-head">
              <span className="card-title">Divisão justa de uma conta</span>
            </div>
            <MoneyField
              label="Valor da conta (ex.: aluguel)"
              value={contaValor}
              onChange={setContaValor}
            />
            <div className="seg casal-seg">
              <button className={rateio === 'prop' ? 'active' : ''} onClick={() => setRateio('prop')}>
                Proporcional à renda
              </button>
              <button className={rateio === 'meio' ? 'active' : ''} onClick={() => setRateio('meio')}>
                Meio a meio
              </button>
            </div>
            <div className="split-cards">
              <div className="split-card credit">
                <div className="sc-tag">
                  <span>{firstName(main.name)}</span>
                  <span className="sc-pct">{pctShare(shareA)}%</span>
                </div>
                <div className="sc-value">{BRL(conta * shareA)}</div>
              </div>
              <div className="split-card debit">
                <div className="sc-tag">
                  <span>{firstName(partner.name)}</span>
                  <span className="sc-pct">{100 - pctShare(shareA)}%</span>
                </div>
                <div className="sc-value">{BRL(conta * (1 - shareA))}</div>
              </div>
            </div>
            {rateio === 'prop' && rendaCasal <= 0 && (
              <p className="casal-note">Sem renda informada, a divisão fica meio a meio.</p>
            )}
          </div>

          {/* Assinaturas em dobro */}
          {dupes.length > 0 && (
            <div className="card">
              <div className="card-head">
                <span className="card-title">Assinaturas em dobro</span>
              </div>
              {dupes.map((d) => (
                <div className="summary-line" key={normName(d.nome)}>
                  <span className="lbl">
                    <span className="dot" style={{ background: 'var(--credit)' }} />
                    {d.nome}
                  </span>
                  <span className="amt">{BRL(d.total)}/mês</span>
                </div>
              ))}
              <p className="casal-note">
                Vocês dois pagam esses serviços. Um plano família ou conta compartilhada
                costuma sair mais barato.
              </p>
            </div>
          )}
        </div>
      </div>

      <p className="casal-note casal-foot">
        Esta visão soma os dados dos dois perfis e os dois podem vê-la. Cada um pode pausar
        o compartilhamento em Configurações → “Visão do casal”.
      </p>
    </div>
  );
}
