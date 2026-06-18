import React, { useEffect, useState } from 'react';
import { TABS } from '../state.js';

const profInitials = (name) => (name || '?').trim().slice(0, 2).toUpperCase();

export default function Sidebar({
  tab, onTab, user, onSignOut, avatar,
  profiles = [], activeProfile, onSwitchProfile, canAddPartner, onAddPartner,
}) {
  const email = user?.email || '';
  const initials = (email.slice(0, 2) || 'EU').toUpperCase();
  const [open, setOpen] = useState(false);

  // Mostra o seletor de perfis só quando faz sentido (plano Duo: há parceiro ou
  // a opção de adicioná-lo). No Solo a barra fica idêntica à de antes.
  const showProfiles = profiles.length > 1 || canAddPartner;

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
            <div className="nav-label">Perfis</div>
            <div className="profile-switch">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  className={'profile-chip' + (activeProfile === p.id ? ' active' : '')}
                  onClick={() => { onSwitchProfile?.(p.id); setOpen(false); }}
                >
                  <span className={'av' + (p.avatar ? ' has-photo' : '')}>
                    {p.avatar ? <img src={p.avatar} alt="" /> : profInitials(p.name)}
                  </span>
                  <span className="profile-chip-name">{p.name}</span>
                </button>
              ))}
              {canAddPartner && (
                <button
                  className="profile-chip profile-chip-add"
                  onClick={() => { onAddPartner?.(); setOpen(false); }}
                >
                  <span className="av av-add">+</span>
                  <span className="profile-chip-name">Adicionar parceiro(a)</span>
                </button>
              )}
            </div>
          </>
        )}

        <div className="nav-label">Painéis</div>
        <nav className="nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={'tab' + (tab === t.id ? ' active' : '')}
              onClick={() => pick(t.id)}
              data-tour={`tab-${t.id}`}
            >
              <span className="ico">{t.ico}</span> {t.label}
            </button>
          ))}
        </nav>

        <div className="side-foot">
          <div className="who">
            <span className={'av' + (avatar ? ' has-photo' : '')}>
              {avatar ? <img src={avatar} alt="Foto de perfil" /> : initials}
            </span>
            <span className="who-mail" title={email}>{email || 'Minha carteira'}</span>
          </div>
          {onSignOut && (
            <button className="signout-btn" onClick={onSignOut}>
              Sair
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
