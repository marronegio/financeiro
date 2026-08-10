import React from 'react';
import { FiLock } from 'react-icons/fi';
import { EXPENSE_TABS } from '../state.js';
import { TAB_ICONS } from './Sidebar.jsx';
import DespesasPanel from './DespesasPanel.jsx';
import CartaoPanel from './CartaoPanel.jsx';
import DebitoPanel from './DebitoPanel.jsx';
import AssinaturasPanel from './AssinaturasPanel.jsx';
import ParcelamentosPanel from './ParcelamentosPanel.jsx';
import ProLocked from './ProLocked.jsx';

// Janela única das despesas: contas fixas, crédito à vista, débito, assinaturas
// e parcelamentos são abas aqui dentro. Tudo que sai da conta no mês vive num
// lugar só; a navegação continua por `tab` (ver EXPENSE_TABS em src/state.js),
// então trocar de aba é uma troca de tela de verdade — entra no histórico do
// botão voltar e o cabeçalho da página acompanha.
export default function DespesasTabs({
  tab,
  onTab,
  state,
  c,
  updateItem,
  addItem,
  removeItem,
  addCategory,
  updateCategory,
  removeCategory,
  isFree = false,
  onUpgrade,
}) {
  const listProps = { updateItem, addItem, removeItem };

  return (
    <>
      <div className="subtabs" role="tablist" aria-label="Painéis de despesas">
        {EXPENSE_TABS.map((t) => {
          const Icon = TAB_ICONS[t.id];
          // No grátis a aba do Pro continua clicável: leva ao convite de
          // upgrade, que explica o que tem lá dentro.
          const locked = isFree && t.proOnly;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={'subtab' + (tab === t.id ? ' active' : '')}
              onClick={() => onTab(t.id)}
              data-tour={`tab-${t.id}`}
            >
              {Icon && <Icon className="subtab-ico" aria-hidden="true" />}
              <span className="subtab-lbl">{t.label}</span>
              {locked && (
                <span className="tab-lock" title="Disponível no plano Pro">
                  <FiLock size={12} aria-label="Disponível no plano Pro" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'cartao' && (
        <CartaoPanel
          state={state}
          c={c}
          {...listProps}
          addCategory={addCategory}
          updateCategory={updateCategory}
          removeCategory={removeCategory}
        />
      )}

      {/* O bloqueio do Pro mora no render, e não na navegação — assim nem o
          tour nem uma aba salva de quando a pessoa era assinante abrem o painel
          de verdade para quem está no grátis. */}
      {tab === 'debito' && (
        isFree ? (
          <div className="panel">
            <div className="single">
              <ProLocked
                feature="debito"
                title="Débito"
                hint="Mercado, Uber, farmácia — o que você paga na hora, com orçamento próprio para o mês."
                onUpgrade={onUpgrade}
              />
            </div>
          </div>
        ) : (
          <DebitoPanel
            state={state}
            c={c}
            {...listProps}
            addCategory={addCategory}
            updateCategory={updateCategory}
            removeCategory={removeCategory}
          />
        )
      )}

      {tab === 'assinaturas' && (
        isFree ? (
          <div className="panel">
            <div className="single">
              <ProLocked
                feature="assinaturas"
                title="Assinaturas"
                hint="Streaming, academia, apps — tudo que se repete todo mês, com o dia da cobrança."
                onUpgrade={onUpgrade}
              />
            </div>
          </div>
        ) : (
          <AssinaturasPanel state={state} c={c} {...listProps} />
        )
      )}

      {tab === 'parcelamentos' && (
        <ParcelamentosPanel
          state={state}
          c={c}
          {...listProps}
          isFree={isFree}
          onUpgrade={onUpgrade}
        />
      )}

      {tab === 'despesas' && <DespesasPanel state={state} c={c} {...listProps} />}
    </>
  );
}
