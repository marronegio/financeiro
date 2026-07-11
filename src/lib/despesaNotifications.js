// Notificações push locais (app nativo) para vencimentos das despesas fixas.
//
// Estratégia: em vez de push via servidor, agendamos notificações LOCAIS no
// aparelho — os dados das despesas já estão aqui, funciona offline e sem
// Firebase. A cada mudança nas despesas (inclusive "já paguei") o agendamento
// é refeito do zero: cancela tudo e agenda só o que ainda vale. Despesa com
// `pago` igual ao período do vencimento não gera aviso naquele ciclo.
//
// Cada pessoa recebe os avisos do PERFIL ATIVO no próprio aparelho (no Duo,
// o perfil ativo é uma escolha por dispositivo).

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { BRL, toNumber } from '../money.js';

const MS_DIA = 86400000;
const HORA_AVISO = 9; // notificações disparam às 9h locais

const periodKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const lastDay = (y, m) => new Date(y, m + 1, 0).getDate();
const atMidnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Junta nomes em prosa: "Aluguel", "Aluguel e Luz", "Aluguel, Luz e Internet".
const listaNomes = (nomes) =>
  nomes.length === 1
    ? nomes[0]
    : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;

// Id determinístico por (dia do disparo, tipo): AAMMDD*10 + tipo. Cabe em int32
// e é estável — reagendar a mesma ocorrência substitui em vez de duplicar.
const notifId = (at, kind) =>
  (at.getFullYear() % 100) * 100000 +
  (at.getMonth() + 1) * 1000 +
  at.getDate() * 10 +
  (kind === 'hoje' ? 0 : 1);

// Monta a lista de notificações a agendar (função pura, testável).
// Para cada despesa com dia de vencimento, nos próximos `mesesHorizonte` meses:
//   - "vence amanhã" às 9h do dia anterior (D-1)
//   - "vence hoje" às 9h do próprio dia (D-0)
// Ocorrências no passado ou do ciclo já marcado como pago ficam de fora.
// Avisos que caem no mesmo dia e tipo são agrupados numa notificação só.
export function buildVencimentoNotifications(despesas, now = new Date(), mesesHorizonte = 2) {
  const hoje = atMidnight(now);
  const porDisparo = new Map(); // `${timestamp}|${kind}` → { at, kind, itens: [] }

  (despesas || []).forEach((d) => {
    const v = parseInt(d.venc, 10);
    if (!v || v < 1 || v > 31) return;

    for (let off = 0; off <= mesesHorizonte; off++) {
      const y = hoje.getFullYear();
      const m = hoje.getMonth() + off;
      const due = new Date(y, m, Math.min(v, lastDay(y, m)));
      if (due < hoje) continue; // vencimento deste mês já passou
      if (d.pago === periodKey(due)) continue; // ciclo já quitado

      const nome = (d.nome || '').trim() || 'Despesa sem nome';
      const valor = toNumber(d.valor);

      for (const [kind, diasAntes] of [['amanha', 1], ['hoje', 0]]) {
        const at = new Date(due.getTime() - diasAntes * MS_DIA);
        at.setHours(HORA_AVISO, 0, 0, 0);
        if (at <= now) continue; // horário do aviso já passou

        const key = `${at.getTime()}|${kind}`;
        if (!porDisparo.has(key)) porDisparo.set(key, { at, kind, itens: [] });
        porDisparo.get(key).itens.push({ nome, valor });
      }
    }
  });

  return [...porDisparo.values()]
    .sort((a, b) => a.at - b.at)
    .map(({ at, kind, itens }) => {
      const quando = kind === 'hoje' ? 'hoje' : 'amanhã';
      const nomes = itens.map((i) => i.nome);
      const total = itens.reduce((s, i) => s + i.valor, 0);
      const valorTxt = total > 0 ? ` — ${BRL(total)}` : '';
      return {
        id: notifId(at, kind),
        at,
        title: itens.length === 1 ? `Conta vence ${quando}` : `${itens.length} contas vencem ${quando}`,
        body:
          itens.length === 1
            ? `${nomes[0]} vence ${quando}${valorTxt}.`
            : `${listaNomes(nomes)} vencem ${quando}${valorTxt}.`,
      };
    });
}

// ── Sincronização com o sistema ─────────────────────────────────────────────

let syncTimer = null;

// Reagenda tudo a partir do estado atual. Debounce interno: mudanças em
// sequência (digitação) viram um único reagendamento.
export function syncVencimentoNotifications(despesas, enabled) {
  if (!Capacitor.isNativePlatform()) return; // navegador: só o e-mail avisa
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => doSync(despesas, enabled), 1500);
}

async function doSync(despesas, enabled) {
  try {
    const { notifications: pending } = await LocalNotifications.getPending();

    if (!enabled) {
      if (pending.length) await LocalNotifications.cancel({ notifications: pending });
      return;
    }

    let { display } = await LocalNotifications.checkPermissions();
    if (display === 'prompt' || display === 'prompt-with-rationale') {
      ({ display } = await LocalNotifications.requestPermissions());
    }
    if (display !== 'granted') return;

    if (pending.length) await LocalNotifications.cancel({ notifications: pending });

    const notifs = buildVencimentoNotifications(despesas);
    if (notifs.length) {
      await LocalNotifications.schedule({
        notifications: notifs.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          schedule: { at: n.at, allowWhileIdle: true },
        })),
      });
    }
  } catch (err) {
    console.warn('Falha ao agendar notificações de vencimento:', err);
  }
}

// Tocar na notificação abre o app na aba de despesas fixas.
export function onVencimentoNotificationTap(callback) {
  if (!Capacitor.isNativePlatform()) return;
  LocalNotifications.addListener('localNotificationActionPerformed', () => callback());
}
