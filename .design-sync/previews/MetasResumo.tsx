import React from 'react';
import { MetasResumo } from 'dinprev';

// Resumo compacto das metas de economia (painel principal).

export const DuasMetas = () => (
  <MetasResumo
    metas={[
      { nome: 'Reserva de emergência', valor: '10.000,00', guardado: '6.500,00', prazo: 'dez/26' },
      { nome: 'Viagem de férias', valor: '4.500,00', guardado: '1.200,00', prazo: 'jul/27' },
    ]}
    onManage={() => {}}
  />
);

export const MetaQuaseCompleta = () => (
  <MetasResumo
    metas={[{ nome: 'Novo notebook', valor: '5.200,00', guardado: '4.940,00' }]}
    onManage={() => {}}
  />
);

export const SemMetas = () => <MetasResumo metas={[]} onManage={() => {}} />;
