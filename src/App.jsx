import React from 'react';
import { useAuth } from './auth/AuthContext.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import Dashboard from './Dashboard.jsx';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="spinner" />
          <p>Carregando…</p>
        </div>
      </div>
    );
  }

  return user ? <Dashboard /> : <AuthScreen />;
}
