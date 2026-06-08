import React from 'react';
import { TABS } from '../state.js';

export default function Sidebar({ tab, onTab, user, onSignOut }) {
  const email = user?.email || '';
  const initials = (email.slice(0, 2) || 'EU').toUpperCase();
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">F</div>
        <div>
          <div className="brand-name">Folium</div>
          <div className="brand-sub">Finanças</div>
        </div>
      </div>

      <div className="nav-label">Painéis</div>
      <nav className="nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={'tab' + (tab === t.id ? ' active' : '')}
            onClick={() => onTab(t.id)}
          >
            <span className="ico">{t.ico}</span> {t.label}
          </button>
        ))}
      </nav>

      <div className="side-foot">
        <div className="who">
          <span className="av">{initials}</span>
          <span className="who-mail" title={email}>{email || 'Minha carteira'}</span>
        </div>
        {onSignOut && (
          <button className="signout-btn" onClick={onSignOut}>
            Sair
          </button>
        )}
      </div>
    </aside>
  );
}
