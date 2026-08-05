import React, { Suspense, lazy, useState } from 'react';
import { BRL, toNumber } from '../money.js';
import { fmtPeriodo, computeInsights } from '../history.js';
import { getCardCategories } from '../state.js';
import MoneyField from './MoneyField.jsx';
import ProLocked from './ProLocked.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import ResumoMesModal from './ResumoMesModal.jsx';
import DiaMesPicker from './DiaMesPicker.jsx';

// Carrega o gráfico (e todo o MUI Charts) só quando a aba Histórico é aberta.
const HistoryChart = lazy(() => import('./HistoryChart.jsx'));

// No plano grátis o mês FECHA normalmente e os resumos continuam sendo
// guardados — só a visualização (insights, gráfico e lista) fica no Pro. Isso é
// de propósito: quanto mais meses a pessoa acumula sem poder ver, maior o motivo
// de assinar, e nada se perde no caminho.
export default function HistoricoPanel({
  state, setField, onClose, onUndoClose, isFree = false, onUpgrade,
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [guardadoInput, setGuardadoInput] = useState('');
  // Confirmação final: fechar o mês não tem volta, então nunca acontece num clique só.
  const [confirmandoFinal, setConfirmandoFinal] = useState(false);
  // Registro do histórico aberto no popup de resumo (null = nenhum).
  const [aberto, setAberto] = useState(null);
  const [desfazendo, setDesfazendo] = useState(false);

  const historico = [...(state.historico || [])].reverse();
  const ultimo = historico[0] || null; // o mês fechado mais recente
  const insights = computeInsights(state.historico);
  // Nasce desligado: o mês só vira sozinho se a pessoa pedir.
  const autoOn = state.fechamentoAuto === true;
  const dia = parseInt(state.fechamentoDia, 10);
  const diaOk = dia >= 1 && dia <= 31;

  function handleConfirmar() {
    onClose(toNumber(guardadoInput));
    setConfirmandoFinal(false);
    setConfirmando(false);
    setGuardadoInput('');
  }

  return (
    <div className="panel">
      <div className="card">
        <div className="card-head">
          <span className="card-title">Ciclo do mês</span>
        </div>

        <div className="ciclo-row">
          <span className="ciclo-lbl">Fechamento automático</span>
          {autoOn && (
            <DiaMesPicker
              value={state.fechamentoDia || ''}
              onChange={(v) => setField('fechamentoDia', v)}
              hint="Escolha o dia do mês em que o DinPrev fecha o mês pra você."
            />
          )}
          <button
            type="button"
            className="switch"
            role="switch"
            data-on={autoOn}
            aria-checked={autoOn}
            aria-label="Fechamento automático"
            onClick={() => setField('fechamentoAuto', !autoOn)}
          >
            <span className="switch-track"><span className="switch-thumb" /></span>
          </button>
        </div>

        <p className="hint" style={{ borderTop: 'none', paddingTop: 0, marginTop: 10 }}>
          {autoOn
            ? diaOk
              ? <>
                  Todo <b>dia {dia}</b> o mês fecha sozinho: os gastos avulsos do cartão são
                  zerados, cada parcelamento avança uma parcela e o resumo do mês fica guardado
                  abaixo. Em mês sem esse dia — 31 em abril, por exemplo — o fechamento acontece no
                  último dia do mês.
                </>
              : <>Escolha o <b>dia do fechamento</b> para o mês fechar sozinho nessa data.</>
            : 'O mês só fecha quando você usar o botão abaixo. Nada é fechado sozinho.'}
        </p>

        {!confirmando ? (
          <button className="add-btn" style={{ marginTop: 12 }} onClick={() => setConfirmando(true)}>
            ↦ Fechar mês agora
          </button>
        ) : (
          <div className="close-confirm">
            <MoneyField
              label="Quanto você conseguiu guardar este mês?"
              value={guardadoInput}
              onChange={setGuardadoInput}
            />
            <div className="close-actions">
              <button className="btn-confirm" onClick={() => setConfirmandoFinal(true)}>
                Confirmar fechamento
              </button>
              <button
                className="btn-cancel"
                onClick={() => { setConfirmando(false); setGuardadoInput(''); }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Fechou sem querer? Devolve os lançamentos daquele mês. */}
        {ultimo && onUndoClose && (
          <button className="undo-close" onClick={() => setDesfazendo(true)}>
            ↩ Desfazer o fechamento de {fmtPeriodo(ultimo.periodo)}
          </button>
        )}
      </div>

      {isFree && (
        <ProLocked
          feature="historico"
          title="Seu histórico está guardado"
          hint={
            historico.length === 0
              ? 'Assim que você fechar o primeiro mês, ele fica salvo aqui esperando você.'
              : `Você já tem ${historico.length} ${historico.length === 1 ? 'mês fechado' : 'meses fechados'} guardados. Assine para ver a evolução, os insights e o gráfico.`
          }
          onUpgrade={onUpgrade}
        />
      )}

      {!isFree && insights.length > 0 && (
        <div className="card">
          <div className="card-head">
            <span className="card-title">Insights</span>
          </div>
          {insights.map((ins, i) => (
            <div className={'insight-row ' + ins.tone} key={i}>
              <span className="insight-ico">
                {ins.tone === 'pos' ? '▲' : ins.tone === 'neg' ? '▼' : '•'}
              </span>
              <span className="insight-text">{ins.text}</span>
            </div>
          ))}
        </div>
      )}

      {!isFree && (
        <Suspense
          fallback={
            <div className="card">
              <div className="card-head">
                <span className="card-title">Evolução</span>
              </div>
              <p className="hint hist-empty">Carregando gráfico…</p>
            </div>
          }
        >
          <HistoryChart historico={state.historico} />
        </Suspense>
      )}

      {!isFree && (
      <div className="card">
        <div className="card-head">
          <span className="card-title">Resumo mensal</span>
          <span className="card-total">
            {historico.length} {historico.length === 1 ? 'mês' : 'meses'}
          </span>
        </div>

        {historico.length === 0 ? (
          <p className="hint hist-empty">
            Ainda não há meses fechados. Quando chegar o dia do recebimento — ou ao usar “Fechar mês
            agora” — o resumo aparece aqui.
          </p>
        ) : (
          historico.map((h, i) => (
            <button
              type="button"
              className="hist-row"
              key={(h.periodo || '') + '-' + i}
              onClick={() => setAberto(h)}
              title="Ver o resumo completo do mês"
            >
              <div className="hist-per">{fmtPeriodo(h.periodo)}</div>
              <div className="hist-nums">
                <span className="hist-num gasto">
                  <span className="hist-lbl">Gasto</span>
                  {BRL(h.gasto)}
                </span>
                <span
                  className="hist-num"
                  style={{ color: h.guardado >= 0 ? 'var(--positive)' : 'var(--negative)' }}
                >
                  <span className="hist-lbl">Guardado</span>
                  {BRL(h.guardado)}
                </span>
                <span className="hist-open" aria-hidden="true">›</span>
              </div>
            </button>
          ))
        )}

        {historico.length > 0 && (
          <p className="hint">
            Toque em um mês para ver o resumo completo — o que entrou, o que saiu e cada gasto com
            sua categoria — e receber tudo em PDF por e-mail.
          </p>
        )}
      </div>
      )}

      {aberto && (
        <ResumoMesModal
          registro={aberto}
          cats={getCardCategories(state)}
          onClose={() => setAberto(null)}
        />
      )}

      {desfazendo && (
        <ConfirmDialog
          title={`Desfazer o fechamento de ${fmtPeriodo(ultimo?.periodo)}?`}
          message={
            ultimo?.detalhes
              ? 'O resumo sai do histórico e os lançamentos daquele mês voltam: as compras do cartão, a renda extra, as doações avulsas, as parcelas recuam uma posição e as despesas fixas voltam a ficar marcadas como pagas. O que você lançou depois do fechamento continua onde está.'
              : 'Este mês foi fechado antes de o app guardar o detalhamento, então só dá para tirar o resumo do histórico — os lançamentos daquele mês não foram salvos e não voltam.'
          }
          confirmLabel="Desfazer o fechamento"
          cancelLabel="Cancelar"
          onConfirm={() => {
            onUndoClose?.();
            setDesfazendo(false);
          }}
          onCancel={() => setDesfazendo(false)}
        />
      )}

      {confirmandoFinal && (
        <ConfirmDialog
          title="Fechar o mês agora?"
          message={`Vamos registrar ${BRL(toNumber(guardadoInput))} como o que você guardou neste mês. O resumo vai para o histórico, os gastos avulsos do cartão e a renda extra zeram, cada parcelamento avança uma parcela e as despesas fixas voltam a “não pagas”. Não dá para voltar atrás.`}
          confirmLabel="Sim, fechar o mês"
          cancelLabel="Cancelar"
          danger
          onConfirm={handleConfirmar}
          onCancel={() => setConfirmandoFinal(false)}
        />
      )}
    </div>
  );
}
