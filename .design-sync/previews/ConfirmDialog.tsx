import React from 'react';
import { ConfirmDialog } from 'dinprev';

// Modal de confirmação padrão do app (substitui window.confirm).
// O backdrop é position:fixed inset:0 — a moldura com transform vira o
// containing block e dá altura para o modal centralizar dentro do card.
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ position: 'relative', height: 380, transform: 'translateZ(0)', overflow: 'hidden', borderRadius: 12 }}>
    {children}
  </div>
);

export const SairDaConta = () => (
  <Frame>
    <ConfirmDialog
      title="Sair da conta?"
      message="Você precisará entrar novamente para acessar seus dados."
      confirmLabel="Sair"
      cancelLabel="Cancelar"
      danger
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  </Frame>
);

export const ExcluirItem = () => (
  <Frame>
    <ConfirmDialog
      title="Excluir esta despesa?"
      message="A despesa 'Internet — R$ 119,90' será removida do mês atual. Essa ação não pode ser desfeita."
      confirmLabel="Excluir"
      cancelLabel="Voltar"
      danger
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  </Frame>
);

export const Processando = () => (
  <Frame>
    <ConfirmDialog
      title="Fechar o mês?"
      message="O mês atual vai para o histórico e um novo mês começa em branco."
      confirmLabel="Fechar mês"
      cancelLabel="Ainda não"
      busy
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  </Frame>
);
