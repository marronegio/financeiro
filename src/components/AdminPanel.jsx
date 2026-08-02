import React, { useEffect, useState, useCallback } from 'react';
import { FiSearch, FiRefreshCw, FiTrash2, FiZap } from 'react-icons/fi';
import { supabase } from '../lib/supabase.js';
import ConfirmDialog from './ConfirmDialog.jsx';

// Painel administrativo, renderizado como aba nativa do app (só o admin vê — ver
// Sidebar/Dashboard). Toda a autoridade fica na Edge Function `admin`: aqui só
// chamamos a função e refletimos o retorno.

// Valor em reais vindo do ASAAS (número) ou null quando não foi possível ler.
const BRL_ = (v) =>
  typeof v === 'number'
    ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
};

// Agrupa o status cru do gateway (subscription_status) em 4 baldes para o filtro.
// Etiqueta e "tone" (cor) acompanham cada balde.
const BUCKETS = {
  active:   { label: 'Ativa',     tone: 'ok' },
  inactive: { label: 'Inativa',   tone: 'muted' },
  past_due: { label: 'Atrasado',  tone: 'warn' },
  canceled: { label: 'Cancelado', tone: 'bad' },
};

const bucketOf = (status) => {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'cancelled':
      return 'canceled';
    default: // inactive, pending, incomplete, etc.
      return 'inactive';
  }
};

// Rótulo em PT do status cru, para a etiqueta do cartão.
const STATUS_LABEL = {
  active: 'Ativa', trialing: 'Em teste', inactive: 'Inativa',
  pending: 'Pendente', past_due: 'Atrasado', canceled: 'Cancelado',
};

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'Ativa' },
  { key: 'inactive', label: 'Inativa' },
  { key: 'past_due', label: 'Atrasado' },
  { key: 'canceled', label: 'Cancelado' },
];

// Controle segmentado (ex.: Ativa / Inativa / Auto). Um clique = uma escolha.
function Seg({ value, options, onPick, disabled }) {
  return (
    <div className="adm-seg" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="adm-seg-btn"
          data-active={value === o.value}
          data-tone={o.tone || ''}
          disabled={disabled}
          onClick={() => value !== o.value && onPick(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // balde de status selecionado
  const [busyId, setBusyId] = useState(''); // id+ação em andamento
  const [confirmDel, setConfirmDel] = useState(null); // usuário a excluir | null

  const callAdmin = useCallback(async (body) => {
    const { data, error: fnError } = await supabase.functions.invoke('admin', { body });
    if (fnError) {
      let msg = fnError.message;
      try {
        const parsed = await fnError.context?.json?.();
        if (parsed?.error) msg = parsed.error;
      } catch { /* usa msg padrão */ }
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await callAdmin({ action: 'list' });
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message || 'Falha ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, [callAdmin]);

  useEffect(() => { load(); }, [load]);

  // Executa uma ação numa linha e atualiza o campo localmente (sem recarregar tudo).
  const act = async (user, action, payload, patch) => {
    setBusyId(user.id + action);
    setError('');
    try {
      await callAdmin({ action, userId: user.id, ...payload });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...patch } : u)));
    } catch (err) {
      setError(err.message || 'Falha na ação.');
    } finally {
      setBusyId('');
    }
  };

  const doDelete = async () => {
    const user = confirmDel;
    setBusyId(user.id + 'delete_user');
    try {
      await callAdmin({ action: 'delete_user', userId: user.id });
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setConfirmDel(null);
    } catch (err) {
      setError(err.message || 'Falha ao excluir.');
    } finally {
      setBusyId('');
    }
  };

  // ── Sincronização de preços das assinaturas ASAAS ────────────────
  // Baixar um preço só vale para quem assina depois; quem já assina segue com o
  // valor gravado na assinatura no ASAAS. Aqui conferimos e realinhamos.
  const [sync, setSync] = useState(null); // resultado da última conferência/aplicação
  const [syncBusy, setSyncBusy] = useState(false);
  const [confirmSync, setConfirmSync] = useState(false);

  const runSync = async (apply) => {
    setSyncBusy(true);
    setError('');
    try {
      const data = await callAdmin({ action: 'asaas_price_sync', apply });
      setSync(data);
      setConfirmSync(false);
    } catch (err) {
      setError(err.message || 'Falha ao sincronizar preços.');
    } finally {
      setSyncBusy(false);
    }
  };

  const q = query.trim().toLowerCase();
  // Contagem por balde (sobre a busca por e-mail, para os números baterem com o
  // que está sendo listado). 'all' = total.
  const bySearch = q ? users.filter((u) => (u.email || '').toLowerCase().includes(q)) : users;
  const counts = bySearch.reduce(
    (acc, u) => {
      const b = bucketOf(u.subscriptionStatus);
      acc[b] = (acc[b] || 0) + 1;
      acc.all += 1;
      return acc;
    },
    { all: 0 },
  );
  const shown = filter === 'all'
    ? bySearch
    : bySearch.filter((u) => bucketOf(u.subscriptionStatus) === filter);

  return (
    <div className="adm">
      <div className="adm-toolbar">
        <div className="adm-search">
          <FiSearch aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar por e-mail…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="adm-count">
          {loading ? 'Carregando…' : `${users.length} usuário(s)`}
        </span>
        <button className="adm-refresh" onClick={load} disabled={loading}>
          <FiRefreshCw aria-hidden="true" /> Atualizar
        </button>
      </div>

      {!loading && (
        <div className="adm-filters" role="group" aria-label="Filtrar por status de assinatura">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className="adm-filter"
              data-active={filter === f.key}
              data-tone={f.key === 'all' ? '' : BUCKETS[f.key].tone}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="adm-filter-count">{counts[f.key] || 0}</span>
            </button>
          ))}
        </div>
      )}

      {error && <div className="adm-error">{error}</div>}

      <div className="card adm-sync">
        <div className="card-head">
          <span className="card-title">Preços das assinaturas (ASAAS)</span>
        </div>
        <p className="hint" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
          A tabela de preços vale para assinaturas novas. Quem já assina continua no valor
          gravado no ASAAS até você realinhar aqui.
        </p>

        {sync && (
          <div className="adm-sync-result">
            <p className="adm-sync-sum">
              {sync.applied
                ? `${sync.alteradas} assinatura(s) atualizada(s) de ${sync.total} verificada(s).`
                : `${sync.pendentes} de ${sync.total} assinatura(s) estão fora do preço de tabela.`}
            </p>
            {sync.rows.filter((r) => !r.skipped || r.changed).length > 0 && (
              <ul className="adm-sync-list">
                {sync.rows
                  .filter((r) => !r.skipped || r.changed)
                  .map((r) => (
                    <li key={r.subscriptionId}>
                      <span className="adm-sync-mail">{r.email || r.userId}</span>
                      <span className="adm-sync-vals">
                        {r.planKey} · {BRL_(r.currentValue)} → <b>{BRL_(r.targetValue)}</b>
                      </span>
                    </li>
                  ))}
              </ul>
            )}
            {sync.rows.some((r) => String(r.skipped || '').startsWith('erro:')) && (
              <p className="adm-sync-err">
                {sync.rows.filter((r) => String(r.skipped || '').startsWith('erro:')).length}{' '}
                assinatura(s) deram erro — veja os logs da função admin.
              </p>
            )}
          </div>
        )}

        <div className="adm-sync-actions">
          <button
            type="button"
            className="adm-mini-btn"
            disabled={syncBusy}
            onClick={() => runSync(false)}
          >
            {syncBusy ? 'Verificando…' : 'Conferir'}
          </button>
          {sync && !sync.applied && sync.pendentes > 0 && (
            <button
              type="button"
              className="cfg-danger-btn"
              disabled={syncBusy}
              onClick={() => setConfirmSync(true)}
            >
              Aplicar a {sync.pendentes} assinatura(s)
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="adm-loading"><div className="spinner" /></div>
      ) : shown.length === 0 ? (
        <div className="adm-empty">Nenhum usuário encontrado.</div>
      ) : (
        <div className="adm-list">
          {shown.map((u) => {
            const anyBusy = busyId.startsWith(u.id);
            return (
              <div className="card adm-user" key={u.id}>
                <div className="adm-user-head">
                  <div className="adm-user-id">
                    <div className="adm-email">
                      {u.email || '(sem e-mail)'}
                      <span
                        className="adm-badge"
                        data-tone={BUCKETS[bucketOf(u.subscriptionStatus)].tone}
                      >
                        {STATUS_LABEL[u.subscriptionStatus] || u.subscriptionStatus}
                      </span>
                    </div>
                    <div className="adm-meta">
                      Criado em {fmtDate(u.createdAt)}
                      {u.provider ? ` · ${u.provider}` : ''}
                    </div>
                  </div>
                  <button
                    className="adm-icon-btn adm-danger"
                    title="Excluir conta"
                    disabled={anyBusy}
                    onClick={() => setConfirmDel(u)}
                  >
                    <FiTrash2 aria-hidden="true" />
                  </button>
                </div>

                <div className="adm-controls">
                  <div className="adm-ctl">
                    <span className="adm-ctl-label">Assinatura</span>
                    <Seg
                      value={u.adminOverride || 'auto'}
                      disabled={anyBusy}
                      options={[
                        { value: 'active', label: 'Ativa', tone: 'ok' },
                        { value: 'inactive', label: 'Inativa', tone: 'bad' },
                        { value: 'auto', label: 'Auto' },
                      ]}
                      onPick={(val) => {
                        const value = val === 'auto' ? null : val;
                        act(u, 'set_subscription', { value }, { adminOverride: value });
                      }}
                    />
                  </div>

                  <div className="adm-ctl">
                    <span className="adm-ctl-label">Assistente de IA</span>
                    <button
                      type="button"
                      className="adm-switch"
                      data-on={u.aiEnabled}
                      disabled={anyBusy}
                      onClick={() => act(u, 'set_ai', { enabled: !u.aiEnabled }, { aiEnabled: !u.aiEnabled })}
                      aria-pressed={u.aiEnabled}
                    >
                      <span className="adm-switch-track"><span className="adm-switch-thumb" /></span>
                      {u.aiEnabled ? 'Ligada' : 'Desligada'}
                    </button>
                  </div>

                  <div className="adm-ctl">
                    <span className="adm-ctl-label">Plano</span>
                    <Seg
                      value={u.plan}
                      disabled={anyBusy}
                      options={[
                        { value: 'free', label: 'Grátis' },
                        { value: 'solo', label: 'Solo' },
                        { value: 'duo', label: 'Duo' },
                      ]}
                      onPick={(val) => act(u, 'set_plan', { plan: val }, { plan: val })}
                    />
                  </div>

                  <div className="adm-ctl">
                    <span className="adm-ctl-label">Créditos de IA (mês)</span>
                    <div className="adm-credits">
                      <span className="adm-chip"><FiZap aria-hidden="true" /> {u.aiCreditsUsed} usados</span>
                      <button
                        type="button"
                        className="adm-mini-btn"
                        disabled={anyBusy}
                        onClick={() => act(u, 'reset_ai', {}, { aiCreditsUsed: 0 })}
                      >
                        Zerar
                      </button>
                    </div>
                  </div>
                </div>

                {anyBusy && <div className="adm-row-busy"><div className="spinner spinner-sm" /></div>}
              </div>
            );
          })}
        </div>
      )}

      {confirmSync && (
        <ConfirmDialog
          title="Aplicar os preços novos?"
          message={`Isto altera o valor de ${sync?.pendentes} assinatura(s) ativa(s) no ASAAS, incluindo as cobranças já geradas e ainda em aberto. Afeta o que essas pessoas pagam na próxima renovação.`}
          confirmLabel="Aplicar"
          cancelLabel="Cancelar"
          danger
          busy={syncBusy}
          onConfirm={() => runSync(true)}
          onCancel={() => setConfirmSync(false)}
        />
      )}

      {confirmDel && (
        <ConfirmDialog
          title="Excluir esta conta?"
          message={`Isto apaga em definitivo os dados e o acesso de ${confirmDel.email || 'este usuário'}. Não dá pra desfazer. (Não cancela cobrança no gateway — cancele lá antes, se for pagante.)`}
          confirmLabel="Excluir conta"
          danger
          busy={busyId === confirmDel.id + 'delete_user'}
          onConfirm={doDelete}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}
