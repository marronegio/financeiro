import React, { useEffect, useRef, useState } from 'react';
import { createDefaultState, CARD_CATEGORIES } from './state.js';
import { supabase } from './lib/supabase.js';
import { useAuth } from './auth/AuthContext.jsx';
import { useProfiles } from './hooks/useProfiles.js';
import { compute } from './money.js';
import { applyRollover, manualClose } from './history.js';
import { useTheme } from './theme.js';
import Sidebar from './components/Sidebar.jsx';
import PlanejamentoPanel from './components/PlanejamentoPanel.jsx';
import CasalPanel from './components/CasalPanel.jsx';
import DespesasPanel from './components/DespesasPanel.jsx';
import AssinaturasPanel from './components/AssinaturasPanel.jsx';
import RendaExtraPanel from './components/RendaExtraPanel.jsx';
import CartaoPanel from './components/CartaoPanel.jsx';
import ParcelamentosPanel from './components/ParcelamentosPanel.jsx';
import EconomiasPanel from './components/EconomiasPanel.jsx';
import HistoricoPanel from './components/HistoricoPanel.jsx';
import ContatoPanel from './components/ContatoPanel.jsx';
import ConfiguracoesPanel from './components/ConfiguracoesPanel.jsx';
import Onboarding from './components/Onboarding.jsx';
import ProfileGate from './components/ProfileGate.jsx';
import DespesaAlerts from './components/DespesaAlerts.jsx';
import AiAssistant from './components/AiAssistant.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import { isAdmin } from './lib/admin.js';
import { applyAiAction, describeAction } from './lib/aiActions.js';
import {
  syncVencimentoNotifications,
  onVencimentoNotificationTap,
} from './lib/despesaNotifications.js';

// Marca, por sessão do navegador, que o usuário Duo já escolheu um perfil. Some
// ao fechar a aba (sessionStorage) — então cada nova sessão volta a perguntar.
const GATE_KEY = 'dinprev_profile_chosen';

const obKey = (id, profile) => `ob_done_${id}_${profile}`;

const newItem = (kind) =>
  kind === 'parcelamentos'
    ? { nome: '', total: '', parcelas: '', pagas: '' }
    : kind === 'cartao'
    ? { nome: '', valor: '', cat: '' }
    : kind === 'metas'
    ? { nome: '', valor: '', guardado: '', prazo: '' }
    : kind === 'despesas'
    ? { nome: '', valor: '', venc: '' }
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
  casal: {
    title: (
      <>
        A visão do <em>casal</em>.
      </>
    ),
    sub: 'Renda, gastos e economia de vocês dois, somados e lado a lado. Cada perfil pode pausar o compartilhamento nas Configurações.',
  },
  rendaextra: {
    title: (
      <>
        Sua renda <em>extra</em> do mês.
      </>
    ),
    sub: 'Ganhos avulsos como freelas, vendas e bônus. Somam à sua renda disponível e zeram a cada fechamento de mês.',
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
  economias: {
    title: (
      <>
        Suas <em>economias</em>.
      </>
    ),
    sub: 'Defina metas de quanto quer juntar e até quando, e acompanhe o progresso de cada uma.',
  },
  historico: {
    title: (
      <>
        Seu histórico <em>mês a mês</em>.
      </>
    ),
    sub: 'Defina os dias do recebimento e da fatura. A cada ciclo, o cartão é zerado, as parcelas avançam e um resumo do mês fica guardado aqui.',
  },
  contato: {
    title: (
      <>
        <em>Fale</em> conosco.
      </>
    ),
    sub: 'Relate um problema ou peça ajuda. Sua mensagem chega direto na nossa equipe e respondemos no e-mail informado.',
  },
  config: {
    title: (
      <>
        <em>Configurações</em> da conta.
      </>
    ),
    sub: 'Gerencie as configurações de segurança da sua conta.',
  },
  admin: {
    title: (
      <>
        Painel <em>administrativo</em>.
      </>
    ),
    sub: 'Gerencie assinaturas, IA, planos e créditos de todos os usuários do DinPrev.',
  },
};

export default function Dashboard({ plan, trialing, provider = 'stripe', aiEnabled = true }) {
  const { user, signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const {
    state, setState, status,
    active, profileList, isDuo, canAddPartner,
    switchProfile, addPartner, renameProfile, removePartner,
    mainNeedsPinSetup, verifyPin, setProfilePin,
    allProfiles, reload,
  } = useProfiles(user.id, plan);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Drawer do menu (mobile). Vive aqui — e não no Sidebar — para o botão
  // voltar do Android poder fechá-lo.
  const [navOpen, setNavOpen] = useState(false);
  const navOpenRef = useRef(navOpen);
  navOpenRef.current = navOpen;

  // Pilha de abas visitadas: o botão voltar do Android navega para trás.
  const tabHistRef = useRef([]);

  // Gate de seleção de perfil (estilo Netflix) — só no Duo, uma vez por sessão.
  const [profileChosen, setProfileChosen] = useState(
    () => !isDuo || sessionStorage.getItem(GATE_KEY) === '1'
  );
  const markChosen = () => {
    sessionStorage.setItem(GATE_KEY, '1');
    setProfileChosen(true);
  };
  const chooseProfile = (id) => { switchProfile(id); markChosen(); };
  const createProfile = (opts) => { addPartner(opts); markChosen(); };
  // Reabre a tela de perfis a partir da sidebar — o PIN (de quem tiver) é pedido
  // de novo, pois o ProfileGate remonta com o estado de desbloqueio zerado.
  const openProfiles = () => setProfileChosen(false);

  // Recuperação de PIN: confere a senha da conta (a credencial real, acima do
  // PIN). Sucesso libera a remoção do PIN esquecido na tela de perfis.
  const recoverWithPassword = async (password) => {
    if (!password) return false;
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
    return !error;
  };

  // Abre o tour só na primeira vez (por perfil): usa a flag salva na nuvem
  // (persiste entre dispositivos/logins); o localStorage fica como reforço.
  useEffect(() => {
    if (!state) return;
    const done = state.onboarded === true || !!localStorage.getItem(obKey(user.id, active));
    if (!done) setShowOnboarding(true);
  }, [state?.onboarded, user.id, active]);

  function finishOnboarding() {
    localStorage.setItem(obKey(user.id, active), '1');
    setState((s) => ({ ...s, onboarded: true, tab: 'plan' }));
    setShowOnboarding(false);
  }

  const setField = (key, value) => setState((s) => ({ ...s, [key]: value }));

  const setTab = (tab) => {
    if (state && state.tab !== tab) {
      tabHistRef.current.push(state.tab);
      if (tabHistRef.current.length > 50) tabHistRef.current.shift();
    }
    setState((s) => ({ ...s, tab }));
  };

  // Botão físico de voltar (Android): fecha o drawer se aberto; senão volta
  // para a aba anterior. Sem nada a fazer, o handler nativo minimiza o app.
  useEffect(() => {
    const onBack = (e) => {
      if (navOpenRef.current) {
        e.preventDefault();
        setNavOpen(false);
        return;
      }
      const prev = tabHistRef.current.pop();
      if (prev) {
        e.preventDefault();
        setState((s) => ({ ...s, tab: prev }));
      }
    };
    window.addEventListener('dinprev-back', onBack);
    return () => window.removeEventListener('dinprev-back', onBack);
  }, [setState]);

  const updateItem = (kind, i, item) =>
    setState((s) => ({ ...s, [kind]: (s[kind] || []).map((it, idx) => (idx === i ? item : it)) }));
  const addItem = (kind) =>
    setState((s) => ({ ...s, [kind]: [...(s[kind] || []), newItem(kind)] }));
  const removeItem = (kind, i) =>
    setState((s) => ({ ...s, [kind]: (s[kind] || []).filter((_, idx) => idx !== i) }));

  // ── Categorias do cartão (personalizáveis por perfil) ──────────────
  // Semeia com as padrão caso o perfil ainda não tenha a lista salva.
  const catsOf = (s) => (s.cardCategories?.length ? s.cardCategories : CARD_CATEGORIES);

  const addCategory = (label, color) =>
    setState((s) => {
      const nome = label.trim();
      if (!nome) return s;
      const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      return { ...s, cardCategories: [...catsOf(s), { id, label: nome, color }] };
    });

  const updateCategory = (id, patch) =>
    setState((s) => ({
      ...s,
      cardCategories: catsOf(s).map((cat) => (cat.id === id ? { ...cat, ...patch } : cat)),
    }));

  const removeCategory = (id) =>
    setState((s) => ({
      ...s,
      cardCategories: catsOf(s).filter((cat) => cat.id !== id),
      // Compras marcadas com a categoria removida voltam a ficar sem etiqueta.
      cartao: (s.cartao || []).map((it) => (it.cat === id ? { ...it, cat: '' } : it)),
    }));

  // "Já paguei": marca a despesa como quitada para o período do vencimento atual,
  // suprimindo o aviso até o próximo mês.
  const marcarDespesaPaga = (idx, duePeriod) =>
    setState((s) => ({
      ...s,
      despesas: s.despesas.map((d, i) => (i === idx ? { ...d, pago: duePeriod } : d)),
    }));

  const reset = () => {
    setState((s) => ({ ...createDefaultState(), tab: s.tab, onboarded: s.onboarded }));
  };

  // Executa uma ação pedida pela IA (lançar gasto/receita, navegar) via setState
  // funcional — assim várias ações numa mesma resposta se acumulam corretamente.
  // Devolve a confirmação em texto que volta para a IA como resultado da tool.
  const runAiAction = (name, args) => {
    setState((s) => applyAiAction(s, name, args));
    return describeAction(name, args);
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

  // Notificações locais de vencimento (app nativo): reagenda sempre que as
  // despesas mudam — inclusive o "já paguei", que remove o aviso daquele ciclo.
  useEffect(() => {
    if (!state) return;
    syncVencimentoNotifications(state.despesas, state.pushVencimentos !== false);
  }, [state?.despesas, state?.pushVencimentos]);

  // Tocar na notificação leva direto às despesas fixas.
  useEffect(() => {
    onVencimentoNotificationTap(() => setState((s) => ({ ...s, tab: 'despesas' })));
  }, [setState]);

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

  // Antes do dashboard, o usuário Duo escolhe (ou cria) o perfil em que vai entrar.
  if (isDuo && !profileChosen) {
    return (
      <div className="app">
        <ProfileGate
          profiles={profileList}
          canAddPartner={canAddPartner}
          mainNeedsPinSetup={mainNeedsPinSetup}
          onPick={chooseProfile}
          onCreate={createProfile}
          onVerifyPin={verifyPin}
          onMainSetup={(pin) => setProfilePin('main', pin)}
          onRecover={recoverWithPassword}
          onSetPin={setProfilePin}
        />
      </div>
    );
  }

  const c = compute(state);
  const listProps = { updateItem, addItem, removeItem };
  // Aba salva pode não existir mais no plano atual (ex.: 'casal' após sair do Duo).
  const tab = state.tab === 'casal' && !isDuo ? 'plan' : state.tab;
  const head = HEADERS[tab] ?? HEADERS.plan;

  return (
    <div className="app">
      <Sidebar
        tab={tab}
        onTab={setTab}
        user={user}
        onSignOut={signOut}
        avatar={state.avatar}
        isDuo={isDuo}
        activeProfile={profileList.find((p) => p.id === active)}
        onOpenProfiles={openProfiles}
        open={navOpen}
        setOpen={setNavOpen}
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

          {tab === 'plan' && (
            <PlanejamentoPanel state={state} c={c} setField={setField} reset={reset} onTab={setTab} />
          )}
          {tab === 'casal' && isDuo && (
            <CasalPanel
              profiles={allProfiles}
              active={active}
              onOpenProfiles={openProfiles}
              onReload={reload}
            />
          )}
          {tab === 'rendaextra' && (
            <RendaExtraPanel state={state} c={c} setField={setField} {...listProps} />
          )}
          {tab === 'despesas' && <DespesasPanel state={state} c={c} {...listProps} />}
          {tab === 'assinaturas' && <AssinaturasPanel state={state} c={c} {...listProps} />}
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
          {tab === 'parcelamentos' && (
            <ParcelamentosPanel state={state} c={c} {...listProps} />
          )}
          {tab === 'economias' && <EconomiasPanel state={state} {...listProps} />}
          {tab === 'historico' && (
            <HistoricoPanel state={state} setField={setField} onClose={fecharMes} />
          )}
          {tab === 'contato' && <ContatoPanel user={user} />}
          {tab === 'config' && (
            <ConfiguracoesPanel
              user={user}
              avatar={state.avatar}
              onAvatar={(dataUrl) => setField('avatar', dataUrl)}
              trialing={trialing}
              provider={provider}
              isDuo={isDuo}
              profiles={profileList}
              activeProfile={active}
              canAddPartner={canAddPartner}
              onAddPartner={addPartner}
              onRenameProfile={renameProfile}
              onRemovePartner={removePartner}
              onVerifyPin={verifyPin}
              onSetPin={setProfilePin}
              emailVencimentos={state.emailVencimentos !== false}
              onToggleEmailVencimentos={(v) => setField('emailVencimentos', v)}
              pushVencimentos={state.pushVencimentos !== false}
              onTogglePushVencimentos={(v) => setField('pushVencimentos', v)}
              compartilharCasal={state.compartilharCasal !== false}
              onToggleCompartilharCasal={(v) => setField('compartilharCasal', v)}
            />
          )}
          {tab === 'admin' && isAdmin(user) && <AdminPanel />}
        </div>
      </main>
      {showOnboarding && (
        <Onboarding
          onFinish={finishOnboarding}
          onSkip={finishOnboarding}
          onStepChange={setTab}
        />
      )}
      {!showOnboarding && (
        <DespesaAlerts despesas={state.despesas} onPaid={marcarDespesaPaga} />
      )}
      {aiEnabled && (
        <AiAssistant state={state} c={c} onAction={runAiAction} tourActive={showOnboarding} />
      )}
    </div>
  );
}
