import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { PLANS, planKey, normalizePlanKey, ANNUAL_SAVE } from '../plans.js';
import { trackMetaEvent } from '../lib/metaPixel.js';

// Segmented control simples, no estilo do card de auth.
function Segmented({ label, options, value, onChange }) {
  return (
    <div
      role="tablist"
      aria-label={label}
      style={{ display: 'flex', gap: 4, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 999, padding: 4, marginBottom: 12 }}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13.5,
              fontWeight: 700,
              fontFamily: 'inherit',
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
  );
}

export default function PaywallPage({ paymentResult }) {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const initial = PLANS[normalizePlanKey(localStorage.getItem('dinprev_plan'))];
  const [tier, setTier] = useState(initial.tier);
  const [cycle, setCycle] = useState(initial.cycle);
  const plan = PLANS[planKey(tier, cycle)];

  // Conversão de compra: o Stripe redireciona de volta com ?payment=success quando o
  // checkout é concluído. Dispara o Purchase uma única vez — a guarda em sessionStorage
  // evita recontar quando o usuário clica em "Recarregar" (que mantém o ?payment=success).
  useEffect(() => {
    if (paymentResult !== 'success') return;
    if (sessionStorage.getItem('dinprev_purchase_tracked')) return;
    sessionStorage.setItem('dinprev_purchase_tracked', '1');
    const purchased = PLANS[normalizePlanKey(localStorage.getItem('dinprev_plan'))];
    trackMetaEvent('Purchase', { value: purchased.value, currency: 'BRL' });
  }, [paymentResult]);

  const perks = tier === 'duo'
    ? ['Dois perfis independentes — você + parceiro(a)', 'Todos os painéis desbloqueados', 'Dados salvos na nuvem', 'Cancele quando quiser']
    : ['7 dias grátis, sem cobrança hoje', 'Todos os painéis desbloqueados', 'Dados salvos na nuvem', 'Cancele quando quiser'];

  async function handleCheckout() {
    setLoading(true);
    setError('');

    const { data: { session } } = await supabase.auth.getSession();

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ origin: window.location.origin, plan: planKey(tier, cycle) }),
      }
    );

    const data = await res.json();
    setLoading(false);

    if (data.url) {
      // Sessão de checkout criada com sucesso — usuário está iniciando o pagamento.
      trackMetaEvent('InitiateCheckout', { value: plan.value, currency: 'BRL' });
      window.location.href = data.url;
    } else {
      setError(data.error || 'Erro ao iniciar pagamento. Tente novamente.');
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 420 }}>

        <div className="auth-brand">
          <span className="logo"><img src="/logo.png" alt="DinPrev" /></span>
          <div>
            <div className="brand-name">DinPrev</div>
            <div className="brand-sub">Finanças pessoais</div>
          </div>
        </div>

        {paymentResult === 'success' ? (
          <>
            <h2 className="auth-title" style={{ color: 'var(--positive)' }}>Pagamento confirmado!</h2>
            <p className="auth-lead">
              Sua assinatura está sendo ativada. Aguarde alguns instantes e recarregue a página.
            </p>
            <button
              className="auth-submit"
              onClick={() => window.location.reload()}
              style={{ marginTop: 24 }}
            >
              Recarregar
            </button>
          </>
        ) : (
          <>
            <h2 className="auth-title">Comece seu teste grátis</h2>
            <p className="auth-lead">
              Sua conta foi criada. Comece com <strong>7 dias grátis</strong> — depois{' '}
              {plan.short}. Sem cobrança hoje.
            </p>

            <Segmented
              label="Plano"
              value={tier}
              onChange={setTier}
              options={[
                { id: 'solo', label: 'Solo' },
                { id: 'duo', label: 'Duo · 2 perfis' },
              ]}
            />
            <Segmented
              label="Período de cobrança"
              value={cycle}
              onChange={setCycle}
              options={[
                { id: 'monthly', label: 'Mensal' },
                { id: 'annual', label: `Anual · ${ANNUAL_SAVE[tier]}` },
              ]}
            />

            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12, padding: '16px 18px', margin: '20px 0 24px' }}>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
                {perks.map(item => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--muted)' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {error && <div className="auth-msg err" style={{ marginBottom: 14 }}>{error}</div>}

            <button
              className="auth-submit"
              onClick={handleCheckout}
              disabled={loading}
            >
              {loading ? 'Redirecionando…' : 'Começar 7 dias grátis'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12.5, color: 'var(--faint)' }}>
              Depois {plan.short} · cancele quando quiser
            </p>
          </>
        )}

        <p className="auth-switch" style={{ marginTop: 20 }}>
          <button type="button" className="auth-link" onClick={signOut}>
            Sair da conta
          </button>
        </p>
      </div>
    </div>
  );
}
