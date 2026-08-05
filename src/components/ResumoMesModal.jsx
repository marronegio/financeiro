import React, { useEffect, useState } from 'react';
import { BRL } from '../money.js';
import { resumoMes } from '../history.js';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthContext.jsx';

// Popup com o resumo completo de um mês fechado: quanto entrou, quanto saiu,
// quanto sobrou guardado e o detalhamento item a item (com as etiquetas das
// compras). Quem quiser leva o mesmo resumo em PDF no e-mail da conta.
export default function ResumoMesModal({ registro, cats = [], onClose }) {
  const { user } = useAuth();
  const r = resumoMes(registro, cats);
  // 'idle' | 'sending' | 'sent' | 'error'
  const [pdf, setPdf] = useState('idle');
  const [erro, setErro] = useState('');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  async function pedirPdf() {
    setPdf('sending');
    setErro('');
    try {
      const { data, error } = await supabase.functions.invoke('month-report', {
        body: {
          periodo: r.periodo,
          resumo: {
            salario: r.salario,
            rendaExtra: r.rendaExtra,
            ganhos: r.ganhos,
            gasto: r.gasto,
            guardado: r.guardado,
            meta: r.meta,
            cartao: r.cartao,
            grupos: r.grupos,
            abates: r.abates,
            rendaExtraItens: r.rendaExtraItens,
          },
        },
      });
      if (error) {
        // Não-2xx vem como FunctionsHttpError com o corpo em `context`.
        let detail = null;
        try {
          detail = await error.context?.json();
        } catch {
          /* corpo não-JSON: fica a mensagem genérica */
        }
        throw new Error(detail?.message || detail?.error || error.message);
      }
      if (data?.error) throw new Error(data.error);
      setPdf('sent');
    } catch (e) {
      setErro(e.message || 'Não foi possível enviar agora. Tente de novo em instantes.');
      setPdf('error');
    }
  }

  const guardadoOk = r.guardado >= 0;
  const diffMeta = r.guardado - r.meta;

  const linha = (label, valor, opts = {}) => (
    <div className={'res-line' + (opts.strong ? ' strong' : '')} key={label}>
      <span className="res-line-lbl">{label}</span>
      <span className="res-line-val" style={opts.color ? { color: opts.color } : undefined}>
        {opts.prefix || ''}{BRL(valor)}
      </span>
    </div>
  );

  return (
    <div className="ob-backdrop" onClick={onClose}>
      <div
        className="res-modal"
        role="dialog"
        aria-label={`Resumo de ${r.label}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="res-head">
          <div>
            <span className="res-kicker">Resumo do mês</span>
            <h2 className="res-title">{r.label}</h2>
          </div>
          <button className="res-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="res-body">
          <div className="res-kpis">
            <div className="res-kpi">
              <span className="res-kpi-lbl">Ganhou</span>
              <span className="res-kpi-val pos">{BRL(r.ganhos)}</span>
            </div>
            <div className="res-kpi">
              <span className="res-kpi-lbl">Gastou</span>
              <span className="res-kpi-val neg">{BRL(r.gasto)}</span>
            </div>
            <div className="res-kpi">
              <span className="res-kpi-lbl">Guardou</span>
              <span className={'res-kpi-val ' + (guardadoOk ? 'save' : 'neg')}>{BRL(r.guardado)}</span>
            </div>
          </div>

          <div className="res-block">
            <div className="res-block-head">
              <span className="res-block-title">Como o mês fechou</span>
            </div>
            {linha('Salário', r.salario)}
            {r.rendaExtra > 0 && linha('Renda extra', r.rendaExtra, { prefix: '+ ' })}
            {linha('Total de gastos', r.gasto, { color: 'var(--expense)' })}
            {r.cartao > 0 && linha('Fatura do cartão', r.cartao)}
            {r.meta > 0 && linha('Meta de economia', r.meta)}
            {linha('Guardado', r.guardado, {
              strong: true,
              color: guardadoOk ? 'var(--positive)' : 'var(--negative)',
            })}
            {r.meta > 0 && (
              <p className="hint res-meta-hint">
                {diffMeta >= 0
                  ? `Você guardou ${BRL(diffMeta)} além da meta deste mês.`
                  : `Faltaram ${BRL(-diffMeta)} para bater a meta deste mês.`}
              </p>
            )}
          </div>

          {!r.temDetalhes && (
            <p className="hint res-nodetail">
              Este mês foi fechado antes de o app passar a guardar o detalhamento, então só os
              totais ficaram salvos. Os próximos meses vêm com tudo item a item.
            </p>
          )}

          {r.rendaExtraItens.length > 0 && (
            <Grupo
              titulo="Renda extra"
              total={r.rendaExtra}
              itens={r.rendaExtraItens}
              tom="pos"
            />
          )}

          {r.grupos.map((g) => (
            <Grupo key={g.id} titulo={g.label} total={g.total} itens={g.itens} />
          ))}

          {r.abates && (
            <Grupo
              titulo={r.abates.label}
              total={r.abates.total}
              itens={r.abates.itens}
              tom="pos"
              prefixo="− "
            />
          )}
        </div>

        <div className="res-foot">
          {pdf === 'sent' ? (
            <p className="hint res-pdf-msg">
              Pronto! O PDF do resumo de {r.label} está a caminho de{' '}
              <b style={{ color: 'var(--ink)' }}>{user?.email}</b>. Se não aparecer em alguns
              minutos, confira a caixa de spam.
            </p>
          ) : (
            <>
              <button className="btn-confirm" onClick={pedirPdf} disabled={pdf === 'sending'}>
                {pdf === 'sending' ? 'Gerando o PDF…' : '⤓ Receber este resumo em PDF'}
              </button>
              <p className="hint res-pdf-msg">
                {pdf === 'error'
                  ? erro
                  : <>Enviamos o arquivo para <b style={{ color: 'var(--ink)' }}>{user?.email}</b>, o e-mail da sua conta.</>}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Bloco de um grupo de lançamentos: título, total e a lista de itens.
function Grupo({ titulo, total, itens, tom = '', prefixo = '' }) {
  return (
    <div className="res-block">
      <div className="res-block-head">
        <span className="res-block-title">{titulo}</span>
        <span className={'res-block-total ' + tom}>{prefixo}{BRL(total)}</span>
      </div>
      {itens.length === 0 ? (
        <p className="hint res-nodetail">Sem itens guardados neste grupo.</p>
      ) : (
        itens.map((it, i) => (
          <div className="res-item" key={(it.nome || '') + i}>
            <span className="res-item-nome">{it.nome || 'Sem nome'}</span>
            {it.catLabel && (
              <span
                className="res-tag"
                style={it.catColor ? { color: it.catColor, borderColor: it.catColor } : undefined}
              >
                {it.catLabel}
              </span>
            )}
            {it.tag && <span className="res-tag">{it.tag}</span>}
            <span className="res-item-val">{BRL(it.valor)}</span>
          </div>
        ))
      )}
    </div>
  );
}
