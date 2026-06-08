import React from 'react';
import { createDefaultState } from './state.js';
import { useAuth } from './auth/AuthContext.jsx';
import { useCloudState } from './hooks/useCloudState.js';
import { compute } from './money.js';
import Sidebar from './components/Sidebar.jsx';
import PlanejamentoPanel from './components/PlanejamentoPanel.jsx';
import DespesasPanel from './components/DespesasPanel.jsx';
import AssinaturasPanel from './components/AssinaturasPanel.jsx';
import CartaoPanel from './components/CartaoPanel.jsx';
import ParcelamentosPanel from './components/ParcelamentosPanel.jsx';

const newItem = (kind) =>
  kind === 'parcelamentos'
    ? { nome: '', total: '', parcelas: '', pagas: '' }
    : { nome: '', valor: '' };

// Cabeçalho próprio de cada aba — título com palavra em destaque + subtítulo.
const HEADERS = {
  plan: {
    title: (
      <>
        Pra onde vai o seu <em>salário</em>.
      </>
    ),
    sub: 'Planeje a renda e os gastos, defina quanto guardar, e acompanhe as compras do cartão contra o limite que sobra pra você.',
  },
  despesas: {
    title: (
      <>
        Seus gastos <em>fixos</em> do mês.
      </>
    ),
    sub: 'Contas que se repetem todo mês — aluguel, luz, internet. Elas entram no total de gastos do planejamento.',
  },
  assinaturas: {
    title: (
      <>
        As <em>assinaturas</em> que pesam na conta.
      </>
    ),
    sub: 'Serviços recorrentes como streaming, apps e academia. Some tudo que debita automático todo mês.',
  },
  cartao: {
    title: (
      <>
        Suas compras no <em>cartão</em>.
      </>
    ),
    sub: 'Lance os gastos do cartão e veja quanto ainda cabe no limite de crédito que você planejou.',
  },
  parcelamentos: {
    title: (
      <>
        O que você ainda <em>parcela</em>.
      </>
    ),
    sub: 'Acompanhe as compras parceladas, a parcela do mês e quanto falta pra quitar cada uma.',
  },
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [state, setState, status] = useCloudState(user.id, createDefaultState);

  const setField = (key, value) => setState((s) => ({ ...s, [key]: value }));
  const setTab = (tab) => setState((s) => ({ ...s, tab }));

  const updateItem = (kind, i, item) =>
    setState((s) => ({ ...s, [kind]: s[kind].map((it, idx) => (idx === i ? item : it)) }));
  const addItem = (kind) =>
    setState((s) => ({ ...s, [kind]: [...s[kind], newItem(kind)] }));
  const removeItem = (kind, i) =>
    setState((s) => ({ ...s, [kind]: s[kind].filter((_, idx) => idx !== i) }));

  const reset = () => {
    if (!window.confirm('Limpar todos os dados?')) return;
    setState((s) => ({ ...createDefaultState(), tab: s.tab }));
  };

  // Enquanto os dados do usuário carregam da nuvem.
  if (!state) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="spinner" />
          <p>Carregando seus dados…</p>
        </div>
      </div>
    );
  }

  const c = compute(state);
  const listProps = { updateItem, addItem, removeItem };
  const head = HEADERS[state.tab] ?? HEADERS.plan;

  return (
    <div className="app">
      <Sidebar tab={state.tab} onTab={setTab} user={user} onSignOut={signOut} />
      <main className="main">
        <div className="wrap">
          <header>
            {status === 'error' && (
              <div className="sync-warn">⚠ offline — suas mudanças não estão sendo salvas</div>
            )}
            <h1>{head.title}</h1>
            <p className="sub">{head.sub}</p>
          </header>

          {state.tab === 'plan' && (
            <PlanejamentoPanel state={state} c={c} setField={setField} reset={reset} />
          )}
          {state.tab === 'despesas' && <DespesasPanel state={state} c={c} {...listProps} />}
          {state.tab === 'assinaturas' && <AssinaturasPanel state={state} c={c} {...listProps} />}
          {state.tab === 'cartao' && <CartaoPanel state={state} c={c} {...listProps} />}
          {state.tab === 'parcelamentos' && (
            <ParcelamentosPanel state={state} c={c} {...listProps} />
          )}
        </div>
      </main>
    </div>
  );
}
