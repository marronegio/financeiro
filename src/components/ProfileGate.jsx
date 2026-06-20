import React, { useState, useRef } from 'react';
import CropEditor from './CropEditor.jsx';

const initials = (name) => (name || '?').trim().slice(0, 2).toUpperCase();

// Campo de PIN de 4 dígitos. `masked` esconde os dígitos (desbloqueio);
// visível na definição, pra evitar erro de digitação sem precisar confirmar.
function PinField({ value, onChange, masked = false, autoFocus = false, onComplete }) {
  return (
    <input
      className="pg-pin-input"
      inputMode="numeric"
      autoComplete="off"
      type={masked ? 'password' : 'text'}
      value={value}
      maxLength={4}
      autoFocus={autoFocus}
      placeholder="••••"
      aria-label="PIN de 4 dígitos"
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, '').slice(0, 4);
        onChange(v);
        if (v.length === 4) onComplete?.(v);
      }}
    />
  );
}

// Tela estilo Netflix mostrada (uma vez por sessão) antes do dashboard no plano
// Duo: o usuário escolhe em qual perfil entrar. Perfis com PIN pedem o código
// antes de entrar. Na criação do parceiro — e só no primeiro login do titular —
// é possível definir um PIN opcional de 4 dígitos.
export default function ProfileGate({
  profiles = [], canAddPartner = false, mainNeedsPinSetup = false,
  onPick, onCreate, onVerifyPin, onMainSetup,
}) {
  const [mode, setMode] = useState(mainNeedsPinSetup ? 'setup' : 'select');

  // Criação do parceiro(a)
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [createPin, setCreatePin] = useState('');
  const [cropSrc, setCropSrc] = useState(null);
  const fileRef = useRef(null);

  // Setup do titular (primeiro login)
  const [setupPin, setSetupPin] = useState('');

  // Desbloqueio
  const [target, setTarget] = useState(null); // perfil sendo desbloqueado
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockErr, setUnlockErr] = useState(false);

  // Perfis já liberados nesta passagem pelo gate (incluindo um PIN recém-criado),
  // pra não pedir o código de novo logo depois de defini-lo.
  const [unlocked, setUnlocked] = useState(() => new Set());

  function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result);
    reader.readAsDataURL(file);
  }

  function pick(id) {
    const p = profiles.find((x) => x.id === id);
    if (p?.hasPin && !unlocked.has(id)) {
      setTarget(p);
      setUnlockPin('');
      setUnlockErr(false);
      setMode('unlock');
      return;
    }
    onPick?.(id);
  }

  function submitUnlock(e) {
    e?.preventDefault();
    if (unlockPin.length !== 4) return;
    if (onVerifyPin?.(target.id, unlockPin)) {
      onPick?.(target.id);
    } else {
      setUnlockErr(true);
      setUnlockPin('');
    }
  }

  function submitCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    if (createPin && createPin.length !== 4) return;
    onCreate?.({ name: name.trim(), avatar, pin: createPin || undefined });
  }

  function finishSetup(pin) {
    onMainSetup?.(pin || '');
    if (pin) setUnlocked((s) => new Set(s).add('main')); // acabou de definir → não repede
    setMode('select');
  }

  function backToSelect() {
    setName('');
    setAvatar('');
    setCreatePin('');
    setTarget(null);
    setUnlockPin('');
    setUnlockErr(false);
    setMode('select');
  }

  return (
    <div className="pg">
      <div className="pg-inner">
        <div className="pg-brand">
          <div className="logo"><img src="/logo.png" alt="DinPrev" /></div>
          <span>DinPrev</span>
        </div>

        {/* ── primeiro login do titular: oferta de PIN ── */}
        {mode === 'setup' && (
          <div className="pg-create">
            <h1 className="pg-title">Proteja seu perfil</h1>
            <p className="pg-sub">
              Quer um PIN de 4 dígitos para entrar no seu perfil? É opcional — útil quando você
              divide a conta no plano Duo. Você pode pular e deixar sem PIN.
            </p>
            <PinField value={setupPin} onChange={setSetupPin} autoFocus />
            <div className="pg-create-actions">
              <button type="button" className="pg-btn-ghost" onClick={() => finishSetup('')}>
                Pular
              </button>
              <button
                type="button"
                className="pg-btn"
                disabled={setupPin.length !== 4}
                onClick={() => finishSetup(setupPin)}
              >
                Definir PIN
              </button>
            </div>
          </div>
        )}

        {/* ── seleção de perfil ── */}
        {mode === 'select' && (
          <>
            <h1 className="pg-title">Quem está usando?</h1>
            <p className="pg-sub">Escolha o perfil para continuar.</p>
            <div className="pg-grid">
              {profiles.map((p) => (
                <button key={p.id} className="pg-card" onClick={() => pick(p.id)}>
                  <span className={'pg-av' + (p.avatar ? ' has-photo' : '')}>
                    {p.avatar ? <img src={p.avatar} alt="" /> : initials(p.name)}
                  </span>
                  <span className="pg-name">
                    {p.name}
                    {p.hasPin && <span className="pg-lock" aria-label="protegido por PIN"> 🔒</span>}
                  </span>
                </button>
              ))}
              {canAddPartner && (
                <button className="pg-card" onClick={() => setMode('create')}>
                  <span className="pg-av pg-av-add">+</span>
                  <span className="pg-name">Adicionar perfil</span>
                </button>
              )}
            </div>
          </>
        )}

        {/* ── criação do parceiro(a) ── */}
        {mode === 'create' && (
          <form className="pg-create" onSubmit={submitCreate}>
            <h1 className="pg-title">Novo perfil</h1>
            <p className="pg-sub">
              O segundo perfil do plano Duo — com planejamento, cartão, parcelamentos e histórico próprios.
            </p>

            <button
              type="button"
              className={'pg-av pg-av-lg' + (avatar ? ' has-photo' : '')}
              onClick={() => fileRef.current?.click()}
              aria-label="Escolher foto do perfil"
            >
              {avatar ? <img src={avatar} alt="" /> : (name.trim() ? initials(name) : '+')}
              <span className="pg-av-edit">Foto</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />

            <input
              className="pg-input"
              value={name}
              maxLength={24}
              autoFocus
              placeholder="Nome do parceiro(a)"
              onChange={(e) => setName(e.target.value)}
            />

            <label className="pg-pin-label">PIN de 4 dígitos (opcional)</label>
            <PinField value={createPin} onChange={setCreatePin} />

            <div className="pg-create-actions">
              <button type="button" className="pg-btn-ghost" onClick={backToSelect}>
                Voltar
              </button>
              <button type="submit" className="pg-btn" disabled={!name.trim() || (createPin.length > 0 && createPin.length !== 4)}>
                Criar e entrar
              </button>
            </div>
          </form>
        )}

        {/* ── desbloqueio por PIN ── */}
        {mode === 'unlock' && target && (
          <form className="pg-create" onSubmit={submitUnlock}>
            <span className={'pg-av pg-av-lg' + (target.avatar ? ' has-photo' : '')}>
              {target.avatar ? <img src={target.avatar} alt="" /> : initials(target.name)}
            </span>
            <h1 className="pg-title" style={{ marginTop: 18 }}>{target.name}</h1>
            <p className="pg-sub">Digite o PIN de 4 dígitos para entrar.</p>
            <PinField
              value={unlockPin}
              onChange={(v) => { setUnlockPin(v); setUnlockErr(false); }}
              masked
              autoFocus
              onComplete={() => submitUnlock()}
            />
            {unlockErr && <p className="pg-error">PIN incorreto. Tente de novo.</p>}
            <div className="pg-create-actions">
              <button type="button" className="pg-btn-ghost" onClick={backToSelect}>
                Voltar
              </button>
              <button type="submit" className="pg-btn" disabled={unlockPin.length !== 4}>
                Entrar
              </button>
            </div>
          </form>
        )}
      </div>

      {cropSrc && (
        <CropEditor
          src={cropSrc}
          onSave={(dataUrl) => { setAvatar(dataUrl); setCropSrc(null); }}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  );
}
