import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { useTheme } from '../theme.js';
import CropEditor from './CropEditor.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import EyeIcon from './EyeIcon.jsx';

function PasswordField({ label, value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <label className="cfg-field">
      <span className="field-label">{label}</span>
      <div className="cfg-input-wrap">
        <input
          type={show ? 'text' : 'password'}
          className="cfg-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          autoComplete="off"
        />
        <button
          type="button"
          className="cfg-eye"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        >
          <EyeIcon off={show} />
        </button>
      </div>
    </label>
  );
}

export default function ConfiguracoesPanel({ user, avatar, onAvatar }) {
  const fileRef = useRef(null);
  const [cropSrc, setCropSrc] = useState(null);

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha,  setNovaSenha]  = useState('');
  const [confirmar,  setConfirmar]  = useState('');
  const [loading,    setLoading]    = useState(false);
  const [msg,        setMsg]        = useState(null);

  // Cancelamento de assinatura
  const [confirming, setConfirming] = useState(false);
  const [canceling,  setCanceling]  = useState(false);
  const [cancelErr,  setCancelErr]  = useState('');

  const { theme, setTheme } = useTheme();

  const [portalLoading, setPortalLoading] = useState(false);
  const [portalErr, setPortalErr] = useState('');

  async function handlePortal() {
    setPortalLoading(true);
    setPortalErr('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/customer-portal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ origin: window.location.origin }),
        }
      );
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url; // vai pro portal hospedado do Stripe
        return;
      }
      setPortalErr(data.error || 'Não foi possível abrir o portal. Tente novamente.');
    } catch {
      setPortalErr('Erro de conexão. Tente novamente.');
    }
    setPortalLoading(false);
  }

  async function handleCancelSubscription() {
    setCanceling(true);
    setCancelErr('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
      const data = await res.json();
      if (res.ok && data.ok) {
        // Assinatura cancelada e acesso revogado — recarrega para cair no paywall.
        window.location.reload();
        return;
      }
      setCancelErr(data.error || 'Não foi possível cancelar. Tente novamente.');
    } catch {
      setCancelErr('Erro de conexão. Tente novamente.');
    }
    setCanceling(false);
    setConfirming(false);
  }

  const email    = user?.email || '';
  const initials = (email.slice(0, 2) || 'EU').toUpperCase();

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);

    if (novaSenha !== confirmar) {
      setMsg({ err: 'A nova senha e a confirmação não coincidem.' });
      return;
    }
    if (novaSenha.length < 6) {
      setMsg({ err: 'A nova senha deve ter pelo menos 6 caracteres.' });
      return;
    }
    if (novaSenha === senhaAtual) {
      setMsg({ err: 'A nova senha deve ser diferente da senha atual.' });
      return;
    }

    setLoading(true);

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: senhaAtual,
    });

    if (signInErr) {
      setMsg({ err: 'Senha atual incorreta.' });
      setLoading(false);
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: novaSenha });

    if (updateErr) {
      setMsg({ err: updateErr.message });
      setLoading(false);
      return;
    }

    setMsg({ ok: true });
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmar('');
    setLoading(false);
  }

  return (
    <div className="panel single">
      {/* Foto de perfil */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Foto de perfil</span>
        </div>

        <div className="cfg-avatar-row">
          <div className="cfg-avatar">
            {avatar ? <img src={avatar} alt="Foto de perfil" /> : initials}
          </div>
          <div className="cfg-avatar-btns">
            <button
              type="button"
              className="cfg-submit cfg-submit-sm"
              onClick={() => fileRef.current?.click()}
            >
              {avatar ? 'Trocar foto' : 'Adicionar foto'}
            </button>
            {avatar && (
              <button
                type="button"
                className="btn-cancel"
                onClick={() => onAvatar('')}
              >
                Remover
              </button>
            )}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          hidden
        />
      </div>

      {/* Aparência */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Aparência</span>
        </div>
        <div className="cfg-appearance">
          <span className="field-label" style={{ margin: 0 }}>Tema do aplicativo</span>
          <div className="seg">
            <button
              className={theme === 'light' ? 'active' : ''}
              onClick={() => setTheme('light')}
            >
              ☀ Claro
            </button>
            <button
              className={theme === 'dark' ? 'active' : ''}
              onClick={() => setTheme('dark')}
            >
              ☾ Escuro
            </button>
          </div>
        </div>
      </div>

      {/* Alterar senha */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Alterar senha</span>
        </div>

        <p className="hint" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0, marginBottom: 14 }}>
          Conta:{' '}
          <b style={{ color: 'var(--ink)', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 500 }}>
            {email}
          </b>
        </p>

        <form onSubmit={handleSubmit}>
          <PasswordField label="Senha atual"         value={senhaAtual} onChange={setSenhaAtual} />
          <PasswordField label="Nova senha"           value={novaSenha}  onChange={setNovaSenha}  />
          <PasswordField label="Confirmar nova senha" value={confirmar}  onChange={setConfirmar}  />

          {msg?.err && <p className="cfg-msg cfg-err">{msg.err}</p>}
          {msg?.ok  && <p className="cfg-msg cfg-ok">Senha alterada com sucesso.</p>}

          <button
            type="submit"
            className="cfg-submit"
            disabled={loading || !senhaAtual || !novaSenha || !confirmar}
          >
            {loading ? 'Verificando…' : 'Alterar senha'}
          </button>
        </form>
      </div>

      {/* Assinatura */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Assinatura</span>
        </div>
        <p className="hint" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0, marginBottom: 14 }}>
          Atualize a forma de pagamento, baixe faturas ou gerencie seu plano no portal seguro do
          Stripe.
        </p>
        {portalErr && <p className="cfg-msg cfg-err" style={{ marginTop: 0, marginBottom: 12 }}>{portalErr}</p>}
        <button type="button" className="cfg-submit" onClick={handlePortal} disabled={portalLoading}>
          {portalLoading ? 'Abrindo…' : 'Gerenciar assinatura'}
        </button>

        <p className="hint" style={{ marginTop: 16, marginBottom: 12 }}>
          Prefere encerrar agora? Cancelar remove o acesso ao painel imediatamente. Seus dados ficam
          salvos caso queira voltar.
        </p>
        {cancelErr && <p className="cfg-msg cfg-err" style={{ marginTop: 0, marginBottom: 12 }}>{cancelErr}</p>}
        <button type="button" className="cfg-danger-btn" onClick={() => setConfirming(true)}>
          Cancelar assinatura
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Cancelar assinatura?"
          message="Você vai perder o acesso ao painel imediatamente. Seus dados ficam salvos caso queira voltar depois."
          confirmLabel="Sim, cancelar"
          cancelLabel="Voltar"
          danger
          busy={canceling}
          onConfirm={handleCancelSubscription}
          onCancel={() => setConfirming(false)}
        />
      )}

      {cropSrc && (
        <CropEditor
          src={cropSrc}
          onSave={(dataUrl) => { onAvatar(dataUrl); setCropSrc(null); }}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  );
}
