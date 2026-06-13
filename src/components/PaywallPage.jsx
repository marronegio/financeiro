import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function PaywallPage({ paymentResult }) {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        body: JSON.stringify({ origin: window.location.origin }),
      }
    );

    const data = await res.json();
    setLoading(false);

    if (data.url) {
      window.location.href = data.url;
    } else {
      setError(data.error || 'Erro ao iniciar pagamento. Tente novamente.');
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 420 }}>

        <div className="auth-brand">
          <span className="logo">f</span>
          <div>
            <div className="brand-name">Folium</div>
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
              Sua conta foi criada. Comece com <strong>7 dias grátis</strong> — depois R$27/mês. Sem cobrança hoje.
            </p>

            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12, padding: '16px 18px', marginBottom: 24 }}>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
                {['7 dias grátis, sem cobrança hoje', 'Todos os painéis desbloqueados', 'Dados salvos na nuvem', 'Cancele quando quiser'].map(item => (
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
              Depois R$27/mês · cancele quando quiser
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
