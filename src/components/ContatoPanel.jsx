import React, { useState } from 'react';

// Endpoint PHP servido pela própria hospedagem (mesma origem do app). Pode ser
// sobrescrito por VITE_CONTACT_ENDPOINT se um dia mudar de caminho/host.
const CONTACT_ENDPOINT = import.meta.env.VITE_CONTACT_ENDPOINT || '/contato.php';

// Máscara de telefone com DDD: (11) 91234-5678 / (11) 1234-5678.
function maskWhatsapp(raw) {
  const d = String(raw).replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function ContatoPanel({ user }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [whatsapp, setWhatsapp] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!nome.trim() || !email.trim() || !whatsapp.trim() || !mensagem.trim()) {
      setError('Preencha todos os campos.');
      return;
    }
    if (!emailOk(email.trim())) {
      setError('Digite um e-mail válido.');
      return;
    }
    if (whatsapp.replace(/\D/g, '').length < 10) {
      setError('Informe um WhatsApp válido com DDD.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(CONTACT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim(),
          whatsapp: whatsapp.trim(),
          mensagem: mensagem.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível enviar. Tente novamente.');
      setSent(true);
      setNome('');
      setWhatsapp('');
      setMensagem('');
    } catch (err) {
      setError(err.message || 'Não foi possível enviar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <div className="single">
        <div className="card">
          <div className="card-head">
            <span className="card-title">Fale conosco</span>
          </div>

          {sent ? (
            <div className="contato-done">
              <div className="contato-done-ico">✓</div>
              <p className="contato-done-title">Mensagem enviada!</p>
              <p className="hint" style={{ border: 'none', padding: 0, margin: 0 }}>
                Recebemos seu contato e vamos responder no e-mail informado o quanto antes.
              </p>
              <button className="add-btn" style={{ marginTop: 16 }} onClick={() => setSent(false)}>
                Enviar outra mensagem
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <p className="hint" style={{ border: 'none', paddingTop: 0, marginTop: 0, marginBottom: 16 }}>
                Encontrou um problema ou precisa de ajuda? Escreva pra gente — todos os campos são
                obrigatórios.
              </p>

              <label className="auth-field">
                <span className="field-label">Nome</span>
                <input
                  className="auth-input"
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  autoComplete="name"
                  required
                />
              </label>

              <label className="auth-field">
                <span className="field-label">E-mail</span>
                <input
                  className="auth-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="auth-field">
                <span className="field-label">WhatsApp (com DDD)</span>
                <input
                  className="auth-input"
                  type="tel"
                  inputMode="numeric"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(maskWhatsapp(e.target.value))}
                  placeholder="(11) 91234-5678"
                  autoComplete="tel"
                  required
                />
              </label>

              <label className="auth-field">
                <span className="field-label">Mensagem</span>
                <textarea
                  className="auth-input contato-textarea"
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Conte o que aconteceu ou como podemos ajudar…"
                  rows={5}
                  required
                />
              </label>

              {error && <div className="auth-msg err">{error}</div>}

              <button className="auth-submit" type="submit" disabled={busy}>
                {busy ? 'Enviando…' : 'Enviar mensagem'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
