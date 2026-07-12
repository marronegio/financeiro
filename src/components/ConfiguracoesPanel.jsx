import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { siteUrl } from '../lib/native.js';
import { useTheme } from '../theme.js';
import CropEditor from './CropEditor.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import PinDialog from './PinDialog.jsx';
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

// Card "Indique e ganhe": mostra o link de indicação do usuário e o saldo de
// créditos. Cada indicação confirmada (1º pagamento do indicado) vale 10% de
// desconto na próxima mensalidade; os créditos acumulam (10 = mês grátis).
function ReferralCard() {
  const [info, setInfo] = useState(null); // { code, total, credits, discountNextPct }
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/referral`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );
        const data = await res.json();
        if (ignore) return;
        if (res.ok && data.code) setInfo(data);
        else setErr(data.error || 'Não foi possível carregar seu código.');
      } catch {
        if (!ignore) setErr('Erro de conexão. Tente novamente.');
      }
    })();
    return () => { ignore = true; };
  }, []);

  const link = info ? `${siteUrl}/?ref=${info.code}` : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponível: usuário copia manualmente do campo */
    }
  };

  const share = async () => {
    try {
      await navigator.share({
        title: 'DinPrev',
        text: `Organize suas finanças com o DinPrev. Assine pelo meu link e ganhe 10% de desconto na primeira mensalidade: ${link}`,
      });
    } catch {
      /* usuário cancelou o compartilhamento */
    }
  };

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Indique e ganhe</span>
      </div>
      <p className="hint" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0, marginBottom: 14 }}>
        Cada pessoa que assinar pelo seu link te dá <b style={{ color: 'var(--ink)' }}>10% de
        desconto</b> na sua próxima mensalidade — e ela ganha 10% na primeira dela. Os descontos
        acumulam: 2 indicações = 20%, e com 10 o seu mês sai <b style={{ color: 'var(--ink)' }}>grátis</b>.
        O que passar disso fica guardado para os meses seguintes.
      </p>

      {err && <p className="cfg-msg cfg-err" style={{ marginTop: 0 }}>{err}</p>}

      {info && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              className="cfg-input"
              readOnly
              value={link}
              style={{ flex: 1, fontSize: 12.5, fontFamily: 'IBM Plex Mono, monospace' }}
              onFocus={(e) => e.target.select()}
            />
            <button type="button" className="cfg-submit cfg-submit-sm" style={{ width: 'auto' }} onClick={copy}>
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>

          {typeof navigator.share === 'function' && (
            <button type="button" className="cfg-submit" onClick={share} style={{ marginBottom: 12 }}>
              Compartilhar link
            </button>
          )}

          <p className="hint" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0, marginBottom: 0 }}>
            Indicações confirmadas: <b style={{ color: 'var(--ink)' }}>{info.total}</b>
            {' · '}Créditos disponíveis: <b style={{ color: 'var(--ink)' }}>{info.credits}</b>
            {info.discountNextPct > 0 && (
              <>
                {' · '}Próxima mensalidade:{' '}
                <b style={{ color: 'var(--positive)' }}>
                  {info.discountNextPct >= 100 ? 'grátis' : `${info.discountNextPct}% de desconto`}
                </b>
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}

export default function ConfiguracoesPanel({
  user, avatar, onAvatar, trialing = false, provider = 'stripe',
  isDuo = false, profiles = [], activeProfile, canAddPartner = false,
  onAddPartner, onRenameProfile, onRemovePartner, onVerifyPin, onSetPin,
  emailVencimentos = true, onToggleEmailVencimentos,
  pushVencimentos = true, onTogglePushVencimentos,
  compartilharCasal = true, onToggleCompartilharCasal,
}) {
  // ASAAS não tem portal de autoatendimento como o Stripe; usuários ASAAS só veem
  // a opção de cancelar. O portal fica só para o legado do Stripe.
  const isAsaas = provider === 'asaas';
  const fileRef = useRef(null);
  const [cropSrc, setCropSrc] = useState(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [canceledMsg, setCanceledMsg] = useState('');
  // PIN em edição: { id, name, mode: 'add'|'change'|'remove' } ou null.
  const [pinEdit, setPinEdit] = useState(null);

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

  // Exclusão de conta
  const [deleting, setDeleting] = useState(false);     // modal aberto
  const [delPassword, setDelPassword] = useState('');
  const [delErr, setDelErr] = useState('');
  const [delBusy, setDelBusy] = useState(false);

  async function handleDeleteAccount() {
    setDelBusy(true);
    setDelErr('');
    // Reconfirma a identidade pela senha da conta antes de algo irreversível.
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: delPassword,
    });
    if (signInErr) {
      setDelErr('Senha incorreta.');
      setDelBusy(false);
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
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
        await supabase.auth.signOut();
        window.location.href = '/'; // volta para a landing
        return;
      }
      setDelErr(data.error || 'Não foi possível excluir a conta. Tente novamente.');
    } catch {
      setDelErr('Erro de conexão. Tente novamente.');
    }
    setDelBusy(false);
  }

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
      // Cada gateway tem sua função de cancelamento; roteamos pelo provider.
      const cancelFn = isAsaas ? 'asaas-cancel' : 'cancel-subscription';
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${cancelFn}`,
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
        if (data.immediate === false) {
          // Cancelamento agendado para o fim do teste — o acesso continua até lá.
          const until = data.accessUntil
            ? new Date(data.accessUntil * 1000).toLocaleDateString('pt-BR')
            : null;
          setCanceledMsg(
            until
              ? `Cancelamento confirmado. Você mantém o acesso até ${until} — depois disso, sem novas cobranças.`
              : 'Cancelamento confirmado. Você mantém o acesso até o fim do período já pago — sem novas cobranças.'
          );
          setConfirming(false);
          setCanceling(false);
          return;
        }
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

  const hasPartner = profiles.some((p) => p.id === 'partner');

  return (
    <div className="panel single">
      {/* Perfis (plano Duo) */}
      {isDuo && (
        <div className="card">
          <div className="card-head">
            <span className="card-title">Perfis</span>
          </div>
          <p className="hint" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0, marginBottom: 14 }}>
            No plano Duo você tem dois perfis independentes — cada um com seu próprio planejamento,
            cartão, parcelamentos, economias e histórico. Renomeie como preferir.
          </p>

          {profiles.map((p) => (
            <div className="cfg-field" key={p.id}>
              <span className="field-label">
                {p.id === 'main' ? 'Seu perfil' : 'Perfil do parceiro(a)'}
                {activeProfile === p.id && <span className="cfg-active-tag"> · ativo</span>}
              </span>
              <div className="cfg-input-wrap">
                <input
                  className="cfg-input"
                  value={p.name}
                  maxLength={24}
                  onChange={(e) => onRenameProfile?.(p.id, e.target.value)}
                  placeholder={p.id === 'main' ? 'Você' : 'Parceiro(a)'}
                />
              </div>
              <div className="cfg-pin-row">
                <span className="cfg-pin-status">
                  {p.hasPin ? '🔒 PIN ativo' : 'Sem PIN'}
                </span>
                {p.hasPin ? (
                  <div className="cfg-pin-btns">
                    <button type="button" className="cfg-link-btn" onClick={() => setPinEdit({ id: p.id, name: p.name, mode: 'change' })}>
                      Trocar PIN
                    </button>
                    <button type="button" className="cfg-link-btn cfg-link-danger" onClick={() => setPinEdit({ id: p.id, name: p.name, mode: 'remove' })}>
                      Remover
                    </button>
                  </div>
                ) : (
                  <button type="button" className="cfg-link-btn" onClick={() => setPinEdit({ id: p.id, name: p.name, mode: 'add' })}>
                    Adicionar PIN
                  </button>
                )}
              </div>
            </div>
          ))}

          {canAddPartner && (
            <button type="button" className="cfg-submit" onClick={onAddPartner} style={{ marginTop: 6 }}>
              Adicionar parceiro(a)
            </button>
          )}

          {hasPartner && (
            <>
              <p className="hint" style={{ marginTop: 16, marginBottom: 12 }}>
                Remover o parceiro(a) apaga <b>todos os dados desse perfil</b>. Essa ação não pode ser
                desfeita.
              </p>
              <button type="button" className="cfg-danger-btn" onClick={() => setConfirmingRemove(true)}>
                Remover parceiro(a)
              </button>
            </>
          )}
        </div>
      )}

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

      {/* Notificações */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Notificações</span>
        </div>
        <p className="hint" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0, marginBottom: 14 }}>
          Receba um e-mail no dia anterior ao vencimento de cada despesa fixa (o aviso de
          “vence amanhã”), enviado para <b style={{ color: 'var(--ink)' }}>{email}</b>.
        </p>
        <div className="cfg-appearance">
          <span className="field-label" style={{ margin: 0 }}>Avisos de vencimento por e-mail</span>
          <div className="seg">
            <button
              className={emailVencimentos ? 'active' : ''}
              onClick={() => onToggleEmailVencimentos?.(true)}
            >
              Ativado
            </button>
            <button
              className={!emailVencimentos ? 'active' : ''}
              onClick={() => onToggleEmailVencimentos?.(false)}
            >
              Desativado
            </button>
          </div>
        </div>
        <p className="hint" style={{ borderTop: 'none', marginTop: 14, paddingTop: 0, marginBottom: 14 }}>
          No aplicativo do celular, você também recebe uma notificação às 9h quando uma
          despesa fixa vence amanhã ou vence hoje. Despesa já marcada como paga não gera aviso.
        </p>
        <div className="cfg-appearance">
          <span className="field-label" style={{ margin: 0 }}>Notificações no celular</span>
          <div className="seg">
            <button
              className={pushVencimentos ? 'active' : ''}
              onClick={() => onTogglePushVencimentos?.(true)}
            >
              Ativado
            </button>
            <button
              className={!pushVencimentos ? 'active' : ''}
              onClick={() => onTogglePushVencimentos?.(false)}
            >
              Desativado
            </button>
          </div>
        </div>
      </div>

      {/* Visão do casal (Duo): aceite de compartilhamento deste perfil. Fica
          dentro do perfil de propósito — quem tem PIN protege também esta
          escolha, e o parceiro não consegue reativá-la pelo outro. */}
      {isDuo && (
        <div className="card">
          <div className="card-head">
            <span className="card-title">Visão do casal</span>
          </div>
          <p className="hint" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0, marginBottom: 14 }}>
            A aba “Visão do casal” soma renda, gastos e economia dos dois perfis. Pausar o
            compartilhamento desativa a visão para os dois até você reativar.
          </p>
          <div className="cfg-appearance">
            <span className="field-label" style={{ margin: 0 }}>Compartilhar meus dados</span>
            <div className="seg">
              <button
                className={compartilharCasal ? 'active' : ''}
                onClick={() => onToggleCompartilharCasal?.(true)}
              >
                Ativado
              </button>
              <button
                className={!compartilharCasal ? 'active' : ''}
                onClick={() => onToggleCompartilharCasal?.(false)}
              >
                Pausado
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Indique e ganhe */}
      <ReferralCard />

      {/* Assinatura */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Assinatura</span>
        </div>
        {isAsaas ? (
          <p className="hint" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0, marginBottom: 14 }}>
            Sua assinatura é cobrada via ASAAS. No cartão, a renovação é automática; no PIX, você
            paga a cada ciclo. Prefere encerrar? É só cancelar abaixo.
          </p>
        ) : (
          <>
            <p className="hint" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0, marginBottom: 14 }}>
              Atualize a forma de pagamento, baixe faturas ou gerencie seu plano no portal seguro do
              Stripe.
            </p>
            {portalErr && <p className="cfg-msg cfg-err" style={{ marginTop: 0, marginBottom: 12 }}>{portalErr}</p>}
            <button type="button" className="cfg-submit" onClick={handlePortal} disabled={portalLoading}>
              {portalLoading ? 'Abrindo…' : 'Gerenciar assinatura'}
            </button>
          </>
        )}

        <p className="hint" style={{ marginTop: 16, marginBottom: 12 }}>
          {trialing
            ? 'Prefere encerrar? Como você está no teste grátis, o cancelamento vale só no fim do período — você mantém o acesso até lá e não é cobrado. Seus dados ficam salvos.'
            : isAsaas
              ? 'Prefere encerrar? Você mantém o acesso até o fim do período já pago e não haverá novas cobranças. Seus dados ficam salvos.'
              : 'Prefere encerrar agora? Cancelar remove o acesso ao painel imediatamente. Seus dados ficam salvos caso queira voltar.'}
        </p>
        {cancelErr && <p className="cfg-msg cfg-err" style={{ marginTop: 0, marginBottom: 12 }}>{cancelErr}</p>}
        {canceledMsg ? (
          <p className="cfg-msg cfg-ok" style={{ marginTop: 0 }}>{canceledMsg}</p>
        ) : (
          <button type="button" className="cfg-danger-btn" onClick={() => setConfirming(true)}>
            Cancelar assinatura
          </button>
        )}
      </div>

      {/* Excluir conta (LGPD) */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Excluir conta</span>
        </div>
        <p className="hint" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0, marginBottom: 14 }}>
          Apaga <b>permanentemente</b> sua conta e todos os dados — perfis, planejamento, cartão,
          parcelamentos, economias e histórico{isDuo ? ', incluindo o perfil do parceiro(a)' : ''}.
          A assinatura é cancelada e seus dados são removidos do nosso sistema e do provedor de
          pagamento. Esta ação não pode ser desfeita.
        </p>
        <button type="button" className="cfg-danger-btn" onClick={() => { setDeleting(true); setDelPassword(''); setDelErr(''); }}>
          Excluir minha conta
        </button>
      </div>

      {deleting && (
        <div className="ob-backdrop" onClick={() => !delBusy && setDeleting(false)}>
          <div className="ob-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="ob-title">Excluir conta definitivamente?</h2>
            <p className="ob-desc">
              Tudo será apagado e não há como recuperar. Para confirmar, digite a senha da sua conta.
            </p>
            <PasswordField label="Senha da conta" value={delPassword} onChange={(v) => { setDelPassword(v); setDelErr(''); }} />
            {delErr && <p className="cfg-msg cfg-err" style={{ marginTop: 0 }}>{delErr}</p>}
            <div className="ob-actions">
              <button className="ob-skip" onClick={() => setDeleting(false)} disabled={delBusy}>
                Voltar
              </button>
              <button className="btn-danger" onClick={handleDeleteAccount} disabled={delBusy || !delPassword}>
                {delBusy ? 'Excluindo…' : 'Excluir tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          title={trialing ? 'Cancelar no fim do teste?' : 'Cancelar assinatura?'}
          message={
            trialing
              ? 'Você mantém o acesso até o fim do teste grátis e não será cobrado. Quando o teste terminar, o acesso ao painel é removido. Seus dados ficam salvos.'
              : isAsaas
                ? 'Você mantém o acesso até o fim do período já pago; depois disso, o acesso é removido e não há novas cobranças. Seus dados ficam salvos.'
                : 'Você vai perder o acesso ao painel imediatamente. Seus dados ficam salvos caso queira voltar depois.'
          }
          confirmLabel="Sim, cancelar"
          cancelLabel="Voltar"
          danger
          busy={canceling}
          onConfirm={handleCancelSubscription}
          onCancel={() => setConfirming(false)}
        />
      )}

      {confirmingRemove && (
        <ConfirmDialog
          title="Remover parceiro(a)?"
          message="Todos os dados desse perfil (planejamento, cartão, parcelamentos, economias e histórico) serão apagados. Essa ação não pode ser desfeita."
          confirmLabel="Sim, remover"
          cancelLabel="Voltar"
          danger
          onConfirm={() => { onRemovePartner?.(); setConfirmingRemove(false); }}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}

      {pinEdit && (
        <PinDialog
          mode={pinEdit.mode}
          profileName={pinEdit.name}
          verify={(pin) => onVerifyPin?.(pinEdit.id, pin)}
          onConfirm={(pin) => { onSetPin?.(pinEdit.id, pin); setPinEdit(null); }}
          onCancel={() => setPinEdit(null)}
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
