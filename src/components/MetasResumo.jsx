import React from 'react';
import { BRL, toNumber } from '../money.js';

// Versão compacta (somente leitura) das metas, exibida no painel principal.
export default function MetasResumo({ metas, onManage }) {
  const list = metas || [];
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Economias</span>
        <button className="card-link" onClick={onManage}>Gerenciar</button>
      </div>

      {list.length === 0 ? (
        <p className="hint" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
          Você ainda não tem metas.{' '}
          <button className="card-link" onClick={onManage}>Criar uma meta</button>.
        </p>
      ) : (
        list.map((it, i) => {
          const alvo = toNumber(it.valor);
          const juntado = toNumber(it.guardado);
          const pct = alvo > 0 ? Math.max(0, Math.min(100, (juntado / alvo) * 100)) : 0;
          return (
            <div className="goal-mini" key={i}>
              <div className="goal-mini-top">
                <span className="goal-mini-name">{it.nome || 'Meta'}</span>
                {it.prazo && <span className="goal-mini-date">{it.prazo}</span>}
              </div>
              <div className="goal-mini-bar">
                <span style={{ width: pct + '%' }} />
              </div>
              <div className="goal-mini-vals">
                <span className="goal-mini-cur">{BRL(juntado)}</span>
                <span>{BRL(alvo)}</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
