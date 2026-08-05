import React, { useEffect, useState } from 'react';
import { FiGrid, FiLogOut, FiLock } from 'react-icons/fi';
import { RiSparkling2Line } from 'react-icons/ri';
import { TABS, isExpenseTab } from '../state.js';
import { isAdmin } from '../lib/admin.js';
import { TAB_ICONS } from './Sidebar.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';

const profInitials = (name) => (name || '?').trim().slice(0, 2).toUpperCase();

// Abas fixas da barra: Resumo e Despesas à esquerda, Histórico à direita.
// O botão central abre a IA e o "Mais" abre o restante do menu num sheet.
const PINNED = ['plan', 'despesas', 'historico'];

// Menu inferior do app nativo (substitui a Sidebar no Android/iOS).
export default function BottomNav({
  tab, onTab, user, isDuo = false, isFree = false,
  aiEnabled = true, aiOpen = false, onAiToggle, tourActive = false,
  moreOpen = false, setMoreOpen = () => {},
  onSignOut, activeProfile, onOpenProfiles,
}) {
  // Mesma regra de visibilidade da Sidebar: duoOnly só no Duo, Admin só pro admin.
  const planTabs = TABS.filter((t) => !t.duoOnly || isDuo);
  const navTabs = isAdmin(user)
    ? [...planTabs, { id: 'admin', label: 'Admin' }]
    : planTabs;
  const moreTabs = navTabs.filter((t) => !PINNED.includes(t.id));
  // Crédito à vista, assinaturas e parcelamentos são abas dentro da janela de
  // despesas: com uma delas aberta, quem fica marcado na barra é "Despesas".
  const navTab = isExpenseTab(tab) ? 'despesas' : tab;
  const moreActive = moreTabs.some((t) => t.id === navTab);

  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const pick = (id) => {
    onTab(id);
    setMoreOpen(false);
  };

  // Trava o scroll do conteúdo enquanto o sheet está aberto.
  useEffect(() => {
    document.body.style.overflow = moreOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [moreOpen]);

  const barItem = (id) => {
    const t = navTabs.find((x) => x.id === id);
    if (!t) return null;
    const Icon = TAB_ICONS[t.id];
    return (
      <button
        key={t.id}
        className={'bnav-item' + (navTab === t.id && !moreOpen ? ' active' : '')}
        onClick={() => pick(t.id)}
        data-tour={`tab-${t.id}`}
        aria-label={t.label}
      >
        <span className="bnav-ico">{Icon && <Icon aria-hidden="true" />}</span>
        <span className="bnav-lbl">{t.label}</span>
      </button>
    );
  };

  return (
    <>
      {/* Sheet com o restante dos painéis */}
      <div
        className={'bnav-overlay' + (moreOpen ? ' show' : '')}
        onClick={() => setMoreOpen(false)}
        aria-hidden="true"
      />
      <div
        className={'bnav-sheet' + (moreOpen ? ' open' : '')}
        role="dialog"
        aria-label="Mais painéis"
      >
        <div className="bnav-sheet-handle" />
        <div className="bnav-sheet-title">Painéis</div>
        <div className="bnav-sheet-grid">
          {moreTabs.map((t) => {
            const Icon = TAB_ICONS[t.id];
            return (
              <button
                key={t.id}
                className={'bnav-sheet-item' + (navTab === t.id ? ' active' : '')}
                onClick={() => pick(t.id)}
                data-tour={`tab-${t.id}`}
              >
                <span className="ico">{Icon && <Icon aria-hidden="true" />}</span>
                <span className="bnav-sheet-lbl">{t.label}</span>
                {isFree && t.proOnly && (
                  <span className="tab-lock"><FiLock aria-label="Disponível no plano Pro" /></span>
                )}
              </button>
            );
          })}
          {onSignOut && (
            <button
              className="bnav-sheet-item"
              onClick={() => {
                // Fecha o sheet antes: a confirmação deve aparecer sozinha na tela.
                setMoreOpen(false);
                setConfirmSignOut(true);
              }}
            >
              <span className="ico"><FiLogOut aria-hidden="true" /></span>
              <span className="bnav-sheet-lbl">Sair</span>
            </button>
          )}
        </div>
        {isDuo && (
          <div className="bnav-sheet-foot">
            <button
              className="bnav-sheet-profile"
              onClick={() => {
                setMoreOpen(false);
                onOpenProfiles?.();
              }}
            >
              <span className={'av' + (activeProfile?.avatar ? ' has-photo' : '')}>
                {activeProfile?.avatar
                  ? <img src={activeProfile.avatar} alt="" />
                  : profInitials(activeProfile?.name)}
              </span>
              <span>{activeProfile?.name || 'Perfil'}</span>
              <span className="bnav-switch-ico" aria-hidden="true">⇄</span>
            </button>
          </div>
        )}
      </div>

      {/* Barra fixa inferior */}
      <nav className="bnav" data-tour="bottom-nav">
        {barItem('plan')}
        {barItem('cartao')}
        <div className="bnav-ai-slot">
          {aiEnabled && (
            <button
              className={'bnav-ai' + (aiOpen ? ' on' : '')}
              onClick={() => {
                setMoreOpen(false);
                onAiToggle?.();
              }}
              disabled={tourActive}
              data-tour="ai-fab"
              aria-label="Abrir o Mr. Din, assistente de IA"
              title="Mr. Din — assistente de IA"
            >
              <RiSparkling2Line aria-hidden="true" />
            </button>
          )}
        </div>
        {barItem('historico')}
        <button
          className={'bnav-item' + (moreOpen || moreActive ? ' active' : '')}
          onClick={() => {
            // Chat da IA e sheet não convivem: abrir o "Mais" fecha o chat.
            if (!moreOpen && aiOpen) onAiToggle?.();
            setMoreOpen(!moreOpen);
          }}
          aria-label="Mais painéis"
          aria-expanded={moreOpen}
          data-tour="tab-mais"
        >
          <span className="bnav-ico"><FiGrid aria-hidden="true" /></span>
          <span className="bnav-lbl">Mais</span>
        </button>
      </nav>

      {confirmSignOut && (
        <ConfirmDialog
          title="Sair da conta?"
          message="Você precisará entrar novamente para acessar seus dados."
          confirmLabel="Sair"
          cancelLabel="Cancelar"
          danger
          onConfirm={() => {
            setConfirmSignOut(false);
            onSignOut?.();
          }}
          onCancel={() => setConfirmSignOut(false)}
        />
      )}
    </>
  );
}
