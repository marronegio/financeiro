import React, { useEffect, useRef, useState } from 'react';
import { TABS } from '../state.js';

export default function Sidebar({ tab, onTab, user, onSignOut, avatar, onAvatar }) {
  const email = user?.email || '';
  const initials = (email.slice(0, 2) || 'EU').toUpperCase();
  const [open, setOpen] = useState(false);
  const fileRef = useRef(null);

  // Lê a imagem escolhida, recorta num quadrado e reduz pra ~96px antes de salvar
  // como data URL (fica pequena o bastante pra guardar junto do estado na nuvem).
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reescolher o mesmo arquivo depois
    if (!file || !onAvatar) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 96;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        onAvatar(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

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
          <div className="logo">F</div>
          <div className="brand-name">Folium</div>
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
          <div className="logo">F</div>
          <div>
            <div className="brand-name">Folium</div>
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
            >
              <span className="ico">{t.ico}</span> {t.label}
            </button>
          ))}
        </nav>

        <div className="side-foot">
          <div className="who">
            <span
              className={'av' + (avatar ? ' has-photo' : '')}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
              title={avatar ? 'Trocar foto' : 'Adicionar foto'}
            >
              {avatar ? <img src={avatar} alt="Foto de perfil" /> : initials}
              {avatar && (
                <button
                  className="av-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAvatar('');
                  }}
                  title="Remover foto"
                  aria-label="Remover foto"
                >
                  ×
                </button>
              )}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              hidden
            />
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
