import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import { isSupabaseConfigured } from './lib/supabase.js';
import './styles.css';

// Sem chaves no .env não dá pra inicializar a auth — mostra instruções em vez de quebrar.
function ConfigWarning() {
  return (
    <div className="auth-wrap">
      <div className="auth-card config-warn">
        <h2 className="auth-title">Configuração necessária</h2>
        <p className="auth-lead">
          Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no arquivo{' '}
          <code>.env</code> e reinicie o servidor (<code>npm run dev</code>).
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isSupabaseConfigured ? (
      <AuthProvider>
        <App />
      </AuthProvider>
    ) : (
      <ConfigWarning />
    )}
  </React.StrictMode>,
);
