import React, { useEffect, useState } from 'react';
import {
  FiPieChart,
  FiTrendingUp,
  FiFileText,
  FiRepeat,
  FiCreditCard,
  FiLayers,
  FiTarget,
  FiClock,
  FiMail,
  FiSettings,
  FiShield,
  FiUsers,
  FiHeart,
} from 'react-icons/fi';
import { TABS } from '../state.js';
import { isAdmin } from '../lib/admin.js';
import ConfirmDialog from './ConfirmDialog.jsx';

const profInitials = (name) => (name || '?').trim().slice(0, 2).toUpperCase();

// Ícone (react-icons) de cada aba. Exportado para o BottomNav (app nativo)
// usar exatamente os mesmos ícones.
export const TAB_ICONS = {
  plan: FiPieChart,
  casal: FiUsers,
  rendaextra: FiTrendingUp,
  despesas: FiFileText,
  assinaturas: FiRepeat,
  doacoes: FiHeart,
  cartao: FiCreditCard,
  parcelamentos: FiLayers,
  economias: FiTarget,
  historico: FiClock,
  contato: FiMail,
  config: FiSettings,
  admin: FiShield,
};

export default function Sidebar({
  tab, onTab, user, onSignOut, avatar,
  isDuo = false, activeProfile, onOpenProfiles,
  // Drawer controlado pelo Dashboard (o botão voltar do Android precisa saber
  // se o menu está aberto para fechá-lo em vez de navegar).
  open = false, setOpen = () => {},
}) {
  const email = user?.email || '';
  const initials = (email.slice(0, 2) || 'EU').toUpperCase();

  // Confirmação antes de sair da conta (evita logout acidental).
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  // Abas duoOnly (Visão do casal) só aparecem no plano Duo. A aba "Admin" só
  // existe para o admin (ver src/lib/admin.js). A autoridade real fica no
  // backend; aqui é só a visibilidade do item de menu.
  const planTabs = TABS.filter((t) => !t.duoOnly || isDuo);
  const navTabs = isAdmin(user)
    ? [...planTabs, { id: 'admin', label: 'Admin' }]
    : planTabs;

  // No plano Duo, a troca de perfil não é mais direta: um botão leva de volta à
  // tela de perfis (onde o PIN, se houver, é exigido). No Solo a barra fica igual.
  const showProfiles = isDuo;

  // Trava o scroll do body enquanto o drawer está aberto no mobile.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Fecha o drawer ao apertar Esc.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const pick = (id) => {
    onTab(id);
    setOpen(false);
  };

  return (
    <>
      {/* Topbar só do mobile: marca + botão que abre o menu lateral. */}
      <div className="topbar">
        <button
          className="hamburger"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={open}
        >
          <span /><span /><span />
        </button>
        <div className="topbar-brand">
          <div className="logo"><img src="/logo.png" alt="DinPrev" /></div>
          <div className="brand-name">DinPrev</div>
        </div>
      </div>

      {/* Fundo escuro clicável que fecha o drawer. */}
      <div
        className={'nav-overlay' + (open ? ' show' : '')}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <aside className={'sidebar' + (open ? ' open' : '')}>
        <div className="brand">
          <div className="logo"><img src="/logo.png" alt="DinPrev" /></div>
          <div>
            <div className="brand-name">DinPrev</div>
            <div className="brand-sub">Finanças</div>
          </div>
          <button
            className="drawer-close"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            ×
          </button>
        </div>

        {showProfiles && (
          <>
            <div className="nav-label">Perfil</div>
            <div className="profile-switch">
              <button
                className="profile-chip profile-chip-switch"
                onClick={() => { onOpenProfiles?.(); setOpen(false); }}
              >
                <span className={'av' + (activeProfile?.avatar ? ' has-photo' : '')}>
                  {activeProfile?.avatar
                    ? <img src={activeProfile.avatar} alt="" />
                    : profInitials(activeProfile?.name)}
                </span>
                <span className="profile-chip-name">{activeProfile?.name || 'Perfil'}</span>
                <span className="profile-chip-switch-ico" aria-hidden="true">⇄</span>
              </button>
            </div>
          </>
        )}

        <div className="nav-label">Painéis</div>
        <nav className="nav">
          {navTabs.map((t) => {
            const Icon = TAB_ICONS[t.id];
            return (
              <button
                key={t.id}
                className={'tab' + (tab === t.id ? ' active' : '')}
                onClick={() => pick(t.id)}
                data-tour={`tab-${t.id}`}
              >
                <span className="ico">{Icon && <Icon size={18} aria-hidden="true" />}</span>{' '}
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="side-foot">
          <div className="who">
            <span className={'av' + (avatar ? ' has-photo' : '')}>
              {avatar ? <img src={avatar} alt="Foto de perfil" /> : initials}
            </span>
            <span className="who-mail" title={email}>{email || 'Minha carteira'}</span>
          </div>
          {onSignOut && (
            <button className="signout-btn" onClick={() => setConfirmSignOut(true)}>
              Sair
            </button>
          )}
        </div>
      </aside>

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
