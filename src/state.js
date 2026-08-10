export const STORAGE_KEY = 'dashboard-financeiro-v3';

// Fábrica para sempre devolver objetos/arrays novos (sem referências compartilhadas).
export const createDefaultState = () => ({
  salario: '',
  guardar: '',
  // `split` (divisão crédito/débito da sobra) saiu daqui: nenhuma tela lia nem
  // escrevia esse número, e um default que ninguém escolheu acabou virando um
  // orçamento inventado quando a aba de débito foi ligada nele. O orçamento do
  // débito agora vem do histórico (ver compute em src/money.js). O campo segue
  // no blob de quem já o tinha salvo — inofensivo, nada o lê.
  tab: 'plan',
  despesas: [
    { nome: 'Aluguel', valor: '', venc: '' },
    { nome: 'Luz', valor: '', venc: '' },
    { nome: 'Internet', valor: '', venc: '' },
    { nome: 'Telefone', valor: '', venc: '' },
  ],
  assinaturas: [{ nome: '', valor: '', venc: '' }], // `venc` = dia do mês da cobrança (1–31)
  doacoes: [{ nome: '', valor: '', recorrente: false }], // doações; `recorrente` marca as que se repetem todo mês
  rendaExtra: [{ nome: '', valor: '' }], // ganhos avulsos do mês (freela, venda, bônus); zera no fechamento
  somarRendaExtra: true, // se a renda extra entra na sobra do planejamento
  cartao: [{ nome: '', valor: '', cat: '' }],
  debito: [{ nome: '', valor: '', cat: '' }], // compras pagas na hora (débito, Pix, dinheiro)
  limiteCartao: '', // limite total do cartão de crédito (informado pelo usuário)
  cardCategories: CARD_CATEGORIES.map((c) => ({ ...c })), // etiquetas das compras (editáveis pelo usuário)
  abates: [], // valores abatidos da fatura (estornos, cashback, créditos)
  parcelamentos: [{ nome: '', total: '', parcelas: '', pagas: '' }],
  metas: [], // metas de economia: { nome, valor (alvo), guardado (já juntei), prazo 'YYYY-MM' }
  avatar: '', // foto de perfil opcional (data URL); vazio = mostra as iniciais
  onboarded: false, // true depois que o usuário viu/pulou o tour de introdução
  emailVencimentos: true, // receber por e-mail o aviso de "vence amanhã" das despesas fixas
  pushVencimentos: true, // app: notificações de "vence amanhã" e "vence hoje" das despesas fixas
  compartilharCasal: true, // Duo: este perfil aceita somar seus dados na "Visão do casal" (opt-out)
  // Histórico / ciclo mensal.
  fechamentoDia: '', // dia do mês em que o ciclo fecha (1–31; mês curto fecha no último dia)
  fechamentoAuto: false, // nasce desligado: só liga quem pedir (o mês fecha pelo botão)
  ultimoFechamento: '', // 'YYYY-MM' do último mês já fechado (controle interno)
  historico: [], // resumos mensais { periodo, salario, gasto, guardado, meta }
});

// ── Perfis (plano Duo) ──────────────────────────────────────────────
// O blob salvo na nuvem (v2) guarda 1 ou 2 perfis, cada um com seu próprio
// estado financeiro completo (a forma de createDefaultState). O perfil 'main'
// é o titular da conta; 'partner' só existe no plano Duo.
export const PROFILE_NAMES = { main: 'Você', partner: 'Parceiro(a)' };

export const createDefaultProfiles = () => ({
  v: 2,
  activeProfile: 'main',
  profiles: {
    main: { name: PROFILE_NAMES.main, data: createDefaultState() },
  },
});

// Normaliza o que veio do banco para a forma v2. Aceita:
//  - null/{}                  → conta nova
//  - estado plano antigo (v1) → vira profiles.main.data, sem perda
//  - já v2                    → retorna garantindo que 'main' exista
// Em todos os casos, campos novos do app (ex.: doacoes) são preenchidos com o
// padrão em perfis salvos antes de o campo existir — senão a tela nova quebra.
// O dia do fechamento nasceu depois: quem já tinha um ciclo rodando fechava no
// dia do recebimento, então herda esse dia uma única vez. Sem isso, o ciclo
// dessas contas simplesmente pararia de fechar sozinho. `recebimentoDia` saiu do
// app (era só referência), mas continua no blob dessas contas — é daí que o dia
// é lido; não remova esta linha achando que o campo não existe mais.
const fillState = (data) => {
  const s = { ...createDefaultState(), ...(data || {}) };
  if (!s.fechamentoDia && s.recebimentoDia) {
    s.fechamentoDia = s.recebimentoDia;
    // Essas contas já fechavam sozinhas antes de o botão existir: desligar agora
    // seria uma mudança silenciosa no que elas já faziam. O padrão desligado
    // vale para quem chega de agora em diante. Escolha já salva sempre manda.
    if (data?.fechamentoAuto === undefined) s.fechamentoAuto = true;
  }
  return s;
};

export const migrateState = (raw) => {
  if (raw && raw.v === 2 && raw.profiles && raw.profiles.main) {
    const profiles = {};
    for (const [id, p] of Object.entries(raw.profiles)) {
      profiles[id] = { ...p, data: fillState(p.data) };
    }
    return { ...raw, profiles };
  }
  const flat = raw && typeof raw === 'object' ? raw : {};
  return {
    v: 2,
    activeProfile: 'main',
    profiles: {
      main: { name: PROFILE_NAMES.main, data: fillState(flat) },
    },
  };
};

// Os ícones de cada aba ficam na Sidebar (react-icons), mapeados por id.
// `duoOnly` esconde a aba fora do plano Duo (a Sidebar filtra). `proOnly` NÃO
// esconde: no grátis a aba continua no menu, com cadeado, e abre o convite de
// upgrade em vez do painel (a lista canônica está em src/limits.js).
// Crédito à vista, Débito, Assinaturas e Parcelamentos não estão aqui: viraram
// abas internas da janela "Despesas" (ver EXPENSE_TABS logo abaixo), que entra
// no menu pelo id 'despesas'.
export const TABS = [
  { id: 'plan', label: 'Resumo' },
  { id: 'casal', label: 'Visão do casal', duoOnly: true },
  { id: 'rendaextra', label: 'Renda extra', proOnly: true },
  { id: 'despesas', label: 'Despesas' },
  { id: 'doacoes', label: 'Doações', proOnly: true },
  { id: 'economias', label: 'Economias' },
  { id: 'historico', label: 'Histórico' },
  { id: 'contato', label: 'Fale conosco' },
  { id: 'config', label: 'Configurações' },
];

// A janela "Despesas" reúne cinco painéis em abas internas: tudo que sai da
// sua conta no mês, num lugar só. Os ids continuam sendo `tab` de primeira
// classe (a IA navega para eles, o tour os visita, o botão voltar volta para
// eles) — o que mudou é que só 'despesas' aparece no menu: os outros quatro se
// alcançam pelas abas de dentro.
// 'debito' vem logo depois de 'cartao' de propósito: são as duas listas de
// compras avulsas do mês, e a diferença entre elas é só a forma de pagamento.
export const EXPENSE_TABS = [
  { id: 'cartao', label: 'Crédito à Vista' },
  { id: 'debito', label: 'Débito', proOnly: true },
  { id: 'assinaturas', label: 'Assinaturas', proOnly: true },
  { id: 'parcelamentos', label: 'Parcelamentos' },
  { id: 'despesas', label: 'Despesas Fixas' },
];

export const isExpenseTab = (tabId) => EXPENSE_TABS.some((t) => t.id === tabId);

// Abrir "Despesas" pelo menu cai em Crédito à Vista: é a primeira aba da janela
// e a que mais se mexe no dia a dia. O item de menu divide o id com a aba de
// despesas fixas, então quem entra pelo menu precisa desta tradução — já a
// navegação direta ('despesas' vindo da IA, do tour ou da notificação de
// vencimento) continua abrindo as fixas.
export const EXPENSE_HOME_TAB = 'cartao';
export const menuTabTarget = (tabId) => (tabId === 'despesas' ? EXPENSE_HOME_TAB : tabId);

// Categorias/etiquetas das compras avulsas. A lista é uma só: crédito à vista e
// débito compartilham as mesmas etiquetas, senão "gastos por categoria" contaria
// a mesma alimentação em duas listas separadas e ninguém saberia o total real.
// (O nome `cardCategories` no estado ficou de quando só o cartão as usava.)
export const CARD_CATEGORIES = [
  { id: 'alimentacao', label: 'Alimentação', color: '#e0564c' },
  { id: 'transporte', label: 'Transporte', color: '#3a6ea5' },
  { id: 'lazer', label: 'Lazer', color: '#9b6bff' },
  { id: 'saude', label: 'Saúde', color: '#0e9f6e' },
  { id: 'casa', label: 'Casa', color: '#d98a00' },
  { id: 'compras', label: 'Compras', color: '#635bff' },
  { id: 'outros', label: 'Outros', color: '#8898aa' },
];

// Categorias efetivas do perfil: usa as personalizadas se houver, senão o padrão.
// Garante o fallback para perfis salvos antes de a lista ser editável. "Outros"
// é o destino das compras sem etiqueta, então fica sempre por último.
export const getCardCategories = (state) => {
  const cats = state?.cardCategories?.length ? state.cardCategories : CARD_CATEGORIES;
  return [...cats].sort((a, b) => (a.id === 'outros') - (b.id === 'outros'));
};
