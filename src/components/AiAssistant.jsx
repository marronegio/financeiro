import React, { useEffect, useRef, useState } from 'react';
import { RiSparkling2Line, RiCloseLine, RiSendPlaneFill } from 'react-icons/ri';
import { supabase } from '../lib/supabase.js';
import { BRL } from '../money.js';
import { getCardCategories, TABS } from '../state.js';

// Segurança contra loop infinito de ferramentas numa mesma pergunta.
const MAX_TOOL_ROUNDS = 5;

// Monta o resumo financeiro que a IA recebe como contexto a cada mensagem.
function buildContext(state, c) {
  const tabLabel = TABS.find((t) => t.id === state.tab)?.label || 'Planejamento';
  const categorias = getCardCategories(state)
    .map((cat) => `${cat.id}=${cat.label}`)
    .join(', ');
  const resumo = [
    `Salário: ${BRL(c.salario)}`,
    `Renda extra do mês: ${BRL(c.totRendaExtra)}`,
    `Despesas fixas: ${BRL(c.totDesp)}`,
    `Assinaturas: ${BRL(c.totAss)}`,
    `Compras no cartão: ${BRL(c.totCartao)}`,
    `Parcela do mês: ${BRL(c.parcelaMensal)} (${c.parcelaAtivas} parcelamento(s) ativo(s))`,
    `Fatura do cartão: ${BRL(c.faturaCartao)}`,
    `Meta de guardar: ${BRL(c.guardar)}`,
    `Total de gastos: ${BRL(c.gastos)}`,
    `Sobra do mês: ${BRL(c.sobra)}`,
  ].join('\n');
  return { tab: state.tab, tabLabel, categorias, resumo };
}

const WELCOME =
  'Oi! Sou o assistente do DinPrev. Posso analisar seus gastos, dar dicas e lançar despesas ou receitas pra você. O que precisa?';

export default function AiAssistant({ state, c, onAction }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // `history` é a lista completa enviada à IA (inclui mensagens de tool). A UI só
  // renderiza as de user/assistant com texto — ver `visible`.
  const [history, setHistory] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, open, busy]);

  // Uma "rodada" com a IA: manda o histórico + contexto, aplica as ferramentas
  // que ela pedir e repete até vir uma resposta em texto (ou estourar o limite).
  async function converse(messages) {
    let convo = messages;
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const { data, error: fnError } = await supabase.functions.invoke('ai-assistant', {
        body: { messages: convo, context: buildContext(state, c) },
      });
      if (fnError || data?.error) throw new Error(data?.error || fnError.message);

      const message = data.message;
      convo = [...convo, message];
      setHistory(convo);

      const calls = message.tool_calls || [];
      if (calls.length === 0) return; // resposta final em texto

      // Executa cada ferramenta localmente e devolve o resultado pra IA.
      const results = calls.map((call) => {
        let args = {};
        try {
          args = JSON.parse(call.function.arguments || '{}');
        } catch {
          /* argumentos inválidos: manda objeto vazio */
        }
        const content = onAction(call.function.name, args);
        return { role: 'tool', tool_call_id: call.id, content };
      });
      convo = [...convo, ...results];
      setHistory(convo);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setError('');
    setBusy(true);
    const next = [...history, { role: 'user', content: text }];
    setHistory(next);
    try {
      await converse(next);
    } catch (err) {
      console.error(err);
      setError('Não consegui responder agora. Tente de novo em instantes.');
    } finally {
      setBusy(false);
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Só mensagens com texto visível entram na conversa exibida.
  const visible = history.filter(
    (m) => (m.role === 'user' || m.role === 'assistant') && m.content
  );

  return (
    <>
      <button
        className="ai-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir assistente de IA"
        title="Assistente de IA"
      >
        {open ? <RiCloseLine /> : <RiSparkling2Line />}
      </button>

      {open && (
        <div className="ai-panel" role="dialog" aria-label="Assistente de IA">
          <div className="ai-head">
            <span className="ai-head-title">
              <RiSparkling2Line /> Assistente
            </span>
            <button className="ai-close" onClick={() => setOpen(false)} aria-label="Fechar">
              <RiCloseLine />
            </button>
          </div>

          <div className="ai-msgs" ref={scrollRef}>
            <div className="ai-msg bot">{WELCOME}</div>
            {visible.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role === 'user' ? 'user' : 'bot'}`}>
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="ai-msg bot ai-typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}
            {error && <div className="ai-msg error">{error}</div>}
          </div>

          <div className="ai-input-row">
            <textarea
              className="ai-input"
              rows={1}
              placeholder="Ex: gastei 45 no mercado no cartão"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={busy}
            />
            <button
              className="ai-send"
              onClick={send}
              disabled={busy || !input.trim()}
              aria-label="Enviar"
            >
              <RiSendPlaneFill />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
