import React, { useEffect, useState } from 'react';
import { TABS } from '../state.js';

export default function Sidebar({ tab, onTab, user, onSignOut, avatar }) {
  const email = user?.email || '';
  const initials = (email.slice(0, 2) || 'EU').toUpperCase();
  const [open, setOpen] = useState(false);

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
          <div className="logo">D</div>
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
          <div className="logo">D</div>
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
