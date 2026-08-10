import React, { useEffect, useRef, useState } from 'react';
import { RiSparkling2Line } from 'react-icons/ri';
import { FiLock } from 'react-icons/fi';
import { createDefaultState, CARD_CATEGORIES, isExpenseTab } from './state.js';
import { supabase } from './lib/supabase.js';
import { useAuth } from './auth/AuthContext.jsx';
import { useProfiles } from './hooks/useProfiles.js';
import { compute } from './money.js';
import { applyRollover, manualClose, setFechamentoDia, undoLastClose } from './history.js';
import { useTheme } from './theme.js';
import Sidebar from './components/Sidebar.jsx';
import BottomNav from './components/BottomNav.jsx';
import { isNativeApp } from './lib/native.js';
import PlanejamentoPanel from './components/PlanejamentoPanel.jsx';
import CasalPanel from './components/CasalPanel.jsx';
import DespesasTabs from './components/DespesasTabs.jsx';
import DoacoesPanel from './components/DoacoesPanel.jsx';
import RendaExtraPanel from './components/RendaExtraPanel.jsx';
import EconomiasPanel from './components/EconomiasPanel.jsx';
import HistoricoPanel from './components/HistoricoPanel.jsx';
import ContatoPanel from './components/ContatoPanel.jsx';
import ConfiguracoesPanel from './components/ConfiguracoesPanel.jsx';
import Onboarding from './components/Onboarding.jsx';
import ProfileGate from './components/ProfileGate.jsx';
import DespesaAlerts from './components/DespesaAlerts.jsx';
import AiAssistant from './components/AiAssistant.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import ProLocked from './components/ProLocked.jsx';
import UpgradeScreen from './components/UpgradeScreen.jsx';
import { isProTab, FREE_METAS } from './limits.js';
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
    ? { nome: '', total: '', parcelas: '', pagas: '', pix: false }
    : kind === 'cartao' || kind === 'debito'
    ? { nome: '', valor: '', cat: '' }
    : kind === 'metas'
    ? { nome: '', valor: '', guardado: '', prazo: '' }
    : kind === 'despesas' || kind === 'assinaturas'
    ? { nome: '', valor: '', venc: '' }
    : kind === 'doacoes'
    ? { nome: '', valor: '', recorrente: false }
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
  // As cinco abas da janela de despesas dividem o mesmo título — o que muda é
  // o subtítulo, que explica a aba aberta. Assim a troca de aba não parece uma
  // troca de tela.
  despesas: {
    title: (
      <>
        Tudo que você <em>gasta</em> no mês.
      </>
    ),
    sub: 'Contas que se repetem todo mês — aluguel, luz, internet. Elas entram no total de gastos do planejamento.',
  },
  doacoes: {
    title: (
      <>
        Suas <em>doações</em> do mês.
      </>
    ),
    sub: 'Cadastre o que você doa. Marque as que se repetem todo mês como recorrentes, e elas continuam aqui sem precisar recadastrar.',
  },
  cartao: {
    title: (
      <>
        Tudo que você <em>gasta</em> no mês.
      </>
    ),
    sub: 'Compras avulsas no crédito. Lance os gastos do cartão e veja quanto ainda cabe no limite que você planejou.',
  },
  debito: {
    title: (
      <>
        Tudo que você <em>gasta</em> no mês.
      </>
    ),
    sub: 'Compras pagas na hora — débito, Pix ou dinheiro. Não entram na fatura do cartão, mas contam no total de gastos do mês.',
  },
  assinaturas: {
    title: (
      <>
        Tudo que você <em>gasta</em> no mês.
      </>
    ),
    sub: 'Serviços recorrentes como streaming, apps e academia. Some tudo que debita automático todo mês.',
  },
  parcelamentos: {
    title: (
      <>
        Tudo que você <em>gasta</em> no mês.
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
    sub: 'Escolha o dia em que o mês fecha. A cada ciclo, o cartão é zerado, as parcelas avançam e um resumo do mês fica guardado aqui.',
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

export default function Dashboard({
  tier = 'free', plan, trialing, provider = 'stripe', aiEnabled = true,
  paymentResult = null,
}) {
  const { user, signOut } = useAuth();
  // No grátis o app abre inteiro, só com menos recursos (ver src/limits.js).
  const isFree = tier === 'free';

  // Paywall de upgrade. Guarda qual recurso disparou, para o popup dizer por que
  // apareceu. `paymentResult === 'success'` reabre o popup na volta do checkout,
  // onde ele fica esperando o webhook ativar a assinatura.
  const [upgrade, setUpgrade] = useState(
    paymentResult === 'success' ? { feature: null } : null
  );
  const openUpgrade = (feature) => setUpgrade({ feature });
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

  // App nativo: sheet "Mais" do menu inferior e painel da IA também vivem aqui,
  // pelo mesmo motivo (o botão voltar fecha antes de navegar).
  const [moreOpen, setMoreOpen] = useState(false);
  const moreOpenRef = useRef(moreOpen);
  moreOpenRef.current = moreOpen;
  const [aiOpen, setAiOpen] = useState(false);
  const aiOpenRef = useRef(aiOpen);
  aiOpenRef.current = aiOpen;

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
    setMoreOpen(false); // app: o tour pode terminar com o sheet "Mais" aberto
  }

  // O dia do fechamento passa por um caminho próprio: ele define o período do
  // ciclo, então mexer nele re-ancora o fechamento em vez de disparar um (ver
  // setFechamentoDia em history.js).
  const setField = (key, value) =>
    setState((s) => (key === 'fechamentoDia'
      ? setFechamentoDia(s, value)
      : { ...s, [key]: value }));

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
      if (aiOpenRef.current) {
        e.preventDefault();
        setAiOpen(false);
        return;
      }
      if (moreOpenRef.current) {
        e.preventDefault();
        setMoreOpen(false);
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
  const addItem = (kind) => {
    // Teto de metas do grátis. As outras listas são ilimitadas nos dois planos.
    if (isFree && kind === 'metas' && (state?.metas?.length || 0) >= FREE_METAS) {
      openUpgrade('metas');
      return;
    }
    setState((s) => ({ ...s, [kind]: [...(s[kind] || []), newItem(kind)] }));
  };
  const removeItem = (kind, i) =>
    setState((s) => ({ ...s, [kind]: (s[kind] || []).filter((_, idx) => idx !== i) }));

  // ── Categorias do cartão (personalizáveis por perfil) ──────────────
  // Semeia com as padrão caso o perfil ainda não tenha a lista salva.
  const catsOf = (s) => (s.cardCategories?.length ? s.cardCategories : CARD_CATEGORIES);

  const addCategory = (label, color) => {
    // Categorias personalizadas são do Pro; no grátis valem as 7 padrão.
    if (isFree) {
      openUpgrade('categorias');
      return;
    }
    setState((s) => {
      const nome = label.trim();
      if (!nome) return s;
      const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      return { ...s, cardCategories: [...catsOf(s), { id, label: nome, color }] };
    });
  };

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

  const desfazerFechamento = () => {
    setState((s) => undoLastClose(s));
  };

  // Fechamento automático dos meses pendentes ao abrir o app.
  useEffect(() => {
    if (!state) return;
    setState((s) => applyRollover(s));
    // Reage à definição do dia e ao avanço do último fechamento; converge sozinho.
  }, [state?.fechamentoDia, state?.ultimoFechamento, setState]);

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
  // Verdadeiro quando a aba aberta é do Pro e o usuário está no grátis.
  const lockedTab = isFree && isProTab(tab);

  return (
    <div className={'app' + (isNativeApp ? ' native-nav' : '')}>
      {isNativeApp ? (
        <BottomNav
          tab={tab}
          onTab={setTab}
          user={user}
          isDuo={isDuo}
          isFree={isFree}
          aiEnabled={aiEnabled}
          aiOpen={aiOpen}
          onAiToggle={() => (isFree ? openUpgrade('ia') : setAiOpen((v) => !v))}
          tourActive={showOnboarding}
          moreOpen={moreOpen}
          setMoreOpen={setMoreOpen}
          onSignOut={signOut}
          activeProfile={profileList.find((p) => p.id === active)}
          onOpenProfiles={openProfiles}
        />
      ) : (
        <Sidebar
          tab={tab}
          onTab={setTab}
          user={user}
          onSignOut={signOut}
          avatar={state.avatar}
          isDuo={isDuo}
          isFree={isFree}
          activeProfile={profileList.find((p) => p.id === active)}
          onOpenProfiles={openProfiles}
          open={navOpen}
          setOpen={setNavOpen}
        />
      )}
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
          {/* Abas do Pro: o bloqueio mora AQUI, no render, e não na navegação —
              assim nem o tour nem uma aba salva de quando a pessoa era assinante
              abrem o painel de verdade para quem está no grátis. */}
          {tab === 'rendaextra' && (
            lockedTab ? (
              <ProLocked
                feature="rendaextra"
                title="Renda extra"
                hint="Freelas, vendas e bônus entram no cálculo do quanto sobra no mês."
                onUpgrade={openUpgrade}
              />
            ) : (
              <RendaExtraPanel state={state} c={c} setField={setField} {...listProps} />
            )
          )}
          {tab === 'doacoes' && (
            lockedTab ? (
              <ProLocked
                feature="doacoes"
                title="Doações"
                hint="Dízimos, apadrinhamentos e doações avulsas, separados das despesas fixas."
                onUpgrade={openUpgrade}
              />
            ) : (
              <DoacoesPanel state={state} c={c} {...listProps} />
            )
          )}
          {/* Despesas fixas, crédito à vista, débito, assinaturas e
              parcelamentos: uma janela só, em abas. */}
          {isExpenseTab(tab) && (
            <DespesasTabs
              tab={tab}
              onTab={setTab}
              state={state}
              c={c}
              {...listProps}
              addCategory={addCategory}
              updateCategory={updateCategory}
              removeCategory={removeCategory}
              isFree={isFree}
              onUpgrade={openUpgrade}
            />
          )}
          {tab === 'economias' && <EconomiasPanel state={state} {...listProps} />}
          {tab === 'historico' && (
            <HistoricoPanel
              state={state}
              setField={setField}
              onClose={fecharMes}
              onUndoClose={desfazerFechamento}
              isFree={isFree}
              onUpgrade={openUpgrade}
            />
          )}
          {tab === 'contato' && <ContatoPanel user={user} />}
          {tab === 'config' && (
            <ConfiguracoesPanel
              user={user}
              avatar={state.avatar}
              onAvatar={(dataUrl) => setField('avatar', dataUrl)}
              trialing={trialing}
              provider={provider}
              isFree={isFree}
              onUpgrade={() => openUpgrade(null)}
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
          onMenuChange={setMoreOpen}
        />
      )}
      {!showOnboarding && (
        <DespesaAlerts despesas={state.despesas} onPaid={marcarDespesaPaga} />
      )}
      {aiEnabled && !isFree && (
        <AiAssistant
          state={state}
          c={c}
          onAction={runAiAction}
          tourActive={showOnboarding}
          hideFab={isNativeApp}
          open={aiOpen}
          onOpenChange={setAiOpen}
        />
      )}

      {/* No grátis o Mr. Din não responde, mas o botão continua ali: é o
          principal motivo de assinar, e escondê-lo jogaria fora a conversão. */}
      {aiEnabled && isFree && !isNativeApp && (
        <button
          className="ai-fab ai-fab-locked"
          data-tour="ai-fab"
          onClick={() => openUpgrade('ia')}
          disabled={showOnboarding}
          aria-label="Assistente com IA — disponível no plano Pro"
          title="Mr. Din — disponível no plano Pro"
        >
          <RiSparkling2Line />
          <span className="ai-fab-lock" aria-hidden="true"><FiLock /></span>
        </button>
      )}

      {upgrade && (
        <UpgradeScreen
          feature={upgrade.feature}
          paymentResult={paymentResult}
          onClose={() => setUpgrade(null)}
        />
      )}
    </div>
  );
}
