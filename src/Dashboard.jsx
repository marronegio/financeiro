import React, { useEffect, useState } from 'react';
import { createDefaultState } from './state.js';
import { useAuth } from './auth/AuthContext.jsx';
import { useCloudState } from './hooks/useCloudState.js';
import { compute } from './money.js';
import { applyRollover, manualClose } from './history.js';
import { useTheme } from './theme.js';
import Sidebar from './components/Sidebar.jsx';
import PlanejamentoPanel from './components/PlanejamentoPanel.jsx';
import DespesasPanel from './components/DespesasPanel.jsx';
import AssinaturasPanel from './components/AssinaturasPanel.jsx';
import CartaoPanel from './components/CartaoPanel.jsx';
import ParcelamentosPanel from './components/ParcelamentosPanel.jsx';
import HistoricoPanel from './components/HistoricoPanel.jsx';
import ConfiguracoesPanel from './components/ConfiguracoesPanel.jsx';
import Onboarding from './components/Onboarding.jsx';

const obKey = (id) => `ob_done_${id}`;

const newItem = (kind) =>
  kind === 'parcelamentos'
    ? { nome: '', total: '', parcelas: '', pagas: '' }
    : kind === 'cartao'
    ? { nome: '', valor: '', cat: '' }
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
  historico: {
    title: (
      <>
        Seu histórico <em>mês a mês</em>.
      </>
    ),
    sub: 'Defina os dias do recebimento e da fatura. A cada ciclo, o cartão é zerado, as parcelas avançam e um resumo do mês fica guardado aqui.',
  },
  config: {
    title: (
      <>
        <em>Configurações</em> da conta.
      </>
    ),
    sub: 'Gerencie as configurações de segurança da sua conta.',
  },
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const [state, setState, status] = useCloudState(user.id, createDefaultState);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Abre o tour só na primeira vez: usa a flag salva na nuvem (persiste entre
  // dispositivos/logins); o localStorage fica como compatibilidade/reforço.
  useEffect(() => {
    if (!state) return;
    const done = state.onboarded === true || !!localStorage.getItem(obKey(user.id));
    if (!done) setShowOnboarding(true);
  }, [state?.onboarded, user.id]);

  function finishOnboarding() {
    localStorage.setItem(obKey(user.id), '1');
    setState((s) => ({ ...s, onboarded: true, tab: 'plan' }));
    setShowOnboarding(false);
  }

  const setField = (key, value) => setState((s) => ({ ...s, [key]: value }));
  const setTab = (tab) => setState((s) => ({ ...s, tab }));

  const updateItem = (kind, i, item) =>
    setState((s) => ({ ...s, [kind]: s[kind].map((it, idx) => (idx === i ? item : it)) }));
  const addItem = (kind) =>
    setState((s) => ({ ...s, [kind]: [...s[kind], newItem(kind)] }));
  const removeItem = (kind, i) =>
    setState((s) => ({ ...s, [kind]: s[kind].filter((_, idx) => idx !== i) }));

  const reset = () => {
    setState((s) => ({ ...createDefaultState(), tab: s.tab, onboarded: s.onboarded }));
  };

  const fecharMes = (guardadoReal) => {
    setState((s) => manualClose(s, new Date(), guardadoReal));
  };

  // Fechamento automático dos meses pendentes ao abrir o app.
  useEffect(() => {
    if (!state) return;
    setState((s) => applyRollover(s));
    // Reage à definição do dia e ao avanço do último fechamento; converge sozinho.
  }, [state?.recebimentoDia, state?.ultimoFechamento, setState]);

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
      <Sidebar
        tab={state.tab}
        onTab={setTab}
        user={user}
        onSignOut={signOut}
        avatar={state.avatar}
      />
      <main className="main">
        <div className="wrap">
          <header style={{ position: 'relative' }}>
            {status === 'error' && (
              <div className="sync-warn">⚠ offline — suas mudanças não estão sendo salvas</div>
            )}
            <h1>{head.title}</h1>
            <p className="sub">{head.sub}</p>
            <div className="header-actions">
              <button
                className="help-btn"
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                aria-label="Alternar tema"
              >
                {theme === 'dark' ? '☀' : '☾'}
              </button>
              <button
                className="help-btn"
                onClick={() => setShowOnboarding(true)}
                title="Ver tour de introdução"
              >
                ?
              </button>
            </div>
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
          {state.tab === 'historico' && (
            <HistoricoPanel state={state} setField={setField} onClose={fecharMes} />
          )}
          {state.tab === 'config' && (
            <ConfiguracoesPanel
              user={user}
              avatar={state.avatar}
              onAvatar={(dataUrl) => setField('avatar', dataUrl)}
            />
          )}
        </div>
      </main>
      {showOnboarding && (
        <Onboarding
          onFinish={finishOnboarding}
          onSkip={finishOnboarding}
          onStepChange={setTab}
        />
      )}
    </div>
  );
}
