import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { PLANS, planKey, normalizePlanKey } from '../plans.js';
import { trackMetaEvent } from '../lib/metaPixel.js';

// Popup de pagamento exibido SOBRE a landing (fundo desfocado/escurecido).
// O plano já vem escolhido da landing (planId) — aqui o usuário só escolhe o
// método (cartão ou PIX) e paga. Sem período de teste.
export default function PaywallModal({ open, planId, paymentResult, onClose, onChangePlan, dismissible = true }) {
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [method, setMethod] = useState('CREDIT_CARD'); // 'CREDIT_CARD' | 'PIX'
  const [pix, setPix] = useState(null); // { encodedImage, payload, expirationDate }
  const [discountPct, setDiscountPct] = useState(0); // desconto de indicação na 1ª cobrança
  const [copied, setCopied] = useState(false);
  const pollRef = useRef(null);

  const plan = PLANS[normalizePlanKey(planId)];

  // Conversão de compra no cartão: o ASAAS redireciona de volta com ?payment=success.
  useEffect(() => {
    if (paymentResult !== 'success') return;
    if (sessionStorage.getItem('dinprev_purchase_tracked')) return;
    sessionStorage.setItem('dinprev_purchase_tracked', '1');
    trackMetaEvent('Purchase', { value: plan.value, currency: 'BRL' });
  }, [paymentResult, plan.value]);

  // Enquanto aguarda o pagamento (tela de PIX ou retorno do cartão), verifica a
  // cada 4s se o webhook já ativou a assinatura; ao confirmar, cai no Dashboard.
  useEffect(() => {
    if (!pix && paymentResult !== 'success') return;
    pollRef.current = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('subscription_status')
        .eq('id', user.id)
        .single();
      if (data?.subscription_status === 'active') {
        clearInterval(pollRef.current);
        if (!sessionStorage.getItem('dinprev_purchase_tracked')) {
          sessionStorage.setItem('dinprev_purchase_tracked', '1');
          trackMetaEvent('Purchase', { value: plan.value, currency: 'BRL' });
        }
        window.location.reload();
      }
    }, 4000);
    return () => clearInterval(pollRef.current);
  }, [pix, paymentResult, plan.value]);

  if (!open) return null;

  const perks = plan.tier === 'duo'
    ? ['Dois perfis independentes — você + parceiro(a)', 'Assistente com IA', 'Todos os painéis desbloqueados', 'Cancele quando quiser']
    : ['Assistente com IA', 'Todos os painéis desbloqueados', 'Dados salvos na nuvem', 'Cancele quando quiser'];

  async function handleSubscribe() {
    setLoading(true);
    setError('');

    const { data: { session } } = await supabase.auth.getSession();
    trackMetaEvent('InitiateCheckout', { value: plan.value, currency: 'BRL' });

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-create-subscription`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: planKey(plan.tier, plan.cycle), billingType: method }),
      }
    );

    const data = await res.json();

    if (!res.ok || data.error) {
      setError(data.error || 'Erro ao iniciar pagamento. Tente novamente.');
      setLoading(false);
      return;
    }
    if (data.method === 'CREDIT_CARD' && data.redirectUrl) {
      window.location.href = data.redirectUrl; // checkout hospedado do ASAAS
      return;
    }
    if (data.method === 'PIX' && data.pix) {
      setPix(data.pix);
      setDiscountPct(data.discountPct || 0);
      setLoading(false);
      return;
    }
    setError('Resposta inesperada do pagamento. Tente novamente.');
    setLoading(false);
  }

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(pix.payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponível: usuário copia manualmente do campo */
    }
  };

  // Conteúdo interno do card conforme o estado.
  let body;
  if (paymentResult === 'success') {
    body = (
      <>
        <h2 className="auth-title" style={{ color: 'var(--positive)' }}>Pagamento recebido!</h2>
        <p className="auth-lead">
          Estamos ativando sua assinatura — isso leva só alguns segundos. Você entra no DinPrev
          automaticamente assim que confirmar.
        </p>
        <div className="auth-msg" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginTop: 8 }}>
          <span className="spinner" style={{ width: 16, height: 16 }} />
          Confirmando o pagamento…
        </div>
        <p className="auth-switch" style={{ marginTop: 18 }}>
          Demorando?{' '}
          <button type="button" className="auth-link" onClick={() => window.location.reload()}>
            Recarregar agora
          </button>
        </p>
      </>
    );
  } else if (pix) {
    body = (
      <>
        <h2 className="auth-title">Pague com PIX</h2>
        <p className="auth-lead">
          Escaneie o QR Code no app do seu banco ou use o copia-e-cola. Assim que o pagamento for
          confirmado, seu acesso é liberado automaticamente.
        </p>
        {discountPct > 0 && (
          <p className="auth-msg ok" style={{ marginBottom: 8 }}>
            🎁 Indicação aplicada: {discountPct}% de desconto nesta primeira cobrança.
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 18px' }}>
          <img
            src={`data:image/png;base64,${pix.encodedImage}`}
            alt="QR Code PIX"
            width={220}
            height={220}
            style={{ borderRadius: 12, border: '1px solid var(--line)' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            className="cfg-input"
            readOnly
            value={pix.payload}
            style={{ flex: 1, fontSize: 12, fontFamily: 'monospace' }}
            onFocus={(e) => e.target.select()}
          />
          <button type="button" className="auth-submit" style={{ width: 'auto', padding: '0 16px' }} onClick={copyPix}>
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
        <div className="auth-msg" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
          <span className="spinner" style={{ width: 16, height: 16 }} />
          Aguardando confirmação do pagamento…
        </div>
        <p className="auth-switch" style={{ marginTop: 20 }}>
          <button type="button" className="auth-link" onClick={() => setPix(null)}>
            Voltar e escolher outro método
          </button>
        </p>
      </>
    );
  } else {
    body = (
      <>
        <h2 className="auth-title">Ative sua assinatura</h2>
        <p className="auth-lead">
          Você escolheu o plano{' '}
          <strong>{plan.tier === 'duo' ? 'Duo' : 'Solo'} · {plan.cycle === 'annual' ? 'Anual' : 'Mensal'}</strong>{' '}
          — {plan.short}. Escolha como quer pagar.
        </p>

        <div
          role="tablist"
          aria-label="Forma de pagamento"
          style={{ display: 'flex', gap: 4, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 999, padding: 4, marginBottom: 12 }}
        >
          {[{ id: 'CREDIT_CARD', label: 'Cartão' }, { id: 'PIX', label: 'PIX' }].map((opt) => {
            const active = method === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMethod(opt.id)}
                style={{
                  flex: 1, padding: '9px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? '#fff' : 'var(--muted)',
                  transition: 'background 0.18s, color 0.18s',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12, padding: '16px 18px', margin: '16px 0 20px' }}>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
            {perks.map(item => (
              <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--muted)' }}>
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--faint)', margin: '0 0 16px' }}>
          {method === 'PIX'
            ? 'No PIX você paga a cada ciclo — a gente te lembra quando chegar a hora.'
            : 'No cartão a renovação é automática. Cancele quando quiser.'}
        </p>

        {error && <div className="auth-msg err" style={{ marginBottom: 14 }}>{error}</div>}

        <button className="auth-submit" onClick={handleSubscribe} disabled={loading}>
          {loading ? 'Processando…' : method === 'PIX' ? 'Gerar PIX' : 'Ir para o pagamento'}
        </button>

        <p style={{ textAlign: 'center', marginTop: 14, fontSize: 12.5, color: 'var(--faint)' }}>
          <button type="button" className="auth-link" onClick={onChangePlan}>Trocar plano</button>
        </p>
      </>
    );
  }

  return (
    <div className="pay-modal-backdrop" onClick={dismissible ? onClose : undefined}>
      <div className="pay-modal" onClick={(e) => e.stopPropagation()}>
        {dismissible && (
          <button type="button" className="pay-modal-close" onClick={onClose} aria-label="Fechar">×</button>
        )}
        <div className="auth-card" style={{ maxWidth: '100%' }}>
          <div className="auth-brand">
            <span className="logo"><img src="/logo.png" alt="DinPrev" /></span>
            <div>
              <div className="brand-name">DinPrev</div>
              <div className="brand-sub">Finanças pessoais</div>
            </div>
          </div>

          {body}

          <p className="auth-switch" style={{ marginTop: 18 }}>
            <button type="button" className="auth-link" onClick={signOut}>Sair da conta</button>
          </p>
        </div>
      </div>
    </div>
  );
}
