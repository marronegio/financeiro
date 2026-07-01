import React, { useEffect, useRef, useState } from 'react';
import {
  RiSparkling2Line,
  RiCloseLine,
  RiSendPlaneFill,
  RiImageAddLine,
} from 'react-icons/ri';
import { supabase } from '../lib/supabase.js';
import { BRL, toNumber, computeParcela } from '../money.js';
import { getCardCategories, TABS } from '../state.js';

// Segurança contra loop infinito de ferramentas numa mesma pergunta.
const MAX_TOOL_ROUNDS = 5;

// Tamanho máximo (px) do lado maior da imagem enviada à IA. Redimensionar antes
// de mandar reduz muito o payload em base64 sem perder legibilidade de comprovantes.
const MAX_IMG_SIZE = 1024;

// Lê um arquivo de imagem, redimensiona num <canvas> e devolve um data URL JPEG.
function fileToCompressedDataUrl(file, maxSize = MAX_IMG_SIZE, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagem inválida.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Renderiza o conteúdo de uma mensagem do usuário, que pode ser texto puro ou um
// array (texto + imagem) quando ele anexa uma foto.
function UserContent({ content }) {
  if (typeof content === 'string') return content;
  return (
    <>
      {content.map((part, i) =>
        part.type === 'image_url' ? (
          <img key={i} className="ai-msg-img" src={part.image_url.url} alt="Imagem enviada" />
        ) : (
          part.text && <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}

// Filtra itens sem nome nem valor (linhas em branco do formulário) e formata
// cada um numa linha de lista. `fmt` recebe o item e devolve o texto.
function listaDetalhada(items, fmt) {
  const linhas = (items || [])
    .filter((it) => (it?.nome && it.nome.trim()) || toNumber(it?.valor) > 0 || toNumber(it?.total) > 0)
    .map(fmt);
  return linhas.length ? linhas.map((l) => `  - ${l}`).join('\n') : '  (nenhum)';
}

// Monta o contexto financeiro que a IA recebe a cada mensagem. Inclui tanto os
// totais quanto CADA item nomeado (renda extra, despesas, assinaturas, compras,
// parcelamentos, metas) para a IA saber a origem de cada valor, não só a soma.
function buildContext(state, c) {
  const tabLabel = TABS.find((t) => t.id === state.tab)?.label || 'Planejamento';
  const cats = getCardCategories(state);
  const catLabel = (id) => cats.find((cat) => cat.id === id)?.label || 'Sem categoria';
  const categorias = cats.map((cat) => `${cat.id}=${cat.label}`).join(', ');

  const resumo = [
    `Salário: ${BRL(c.salario)}`,
    `Renda extra do mês: ${BRL(c.totRendaExtra)}${
      c.somarRendaExtra ? ' (somada ao planejamento)' : ' (não somada ao planejamento)'
    }`,
    `Despesas fixas: ${BRL(c.totDesp)}`,
    `Assinaturas: ${BRL(c.totAss)}`,
    `Compras no cartão: ${BRL(c.totCartao)}`,
    `Parcela do mês: ${BRL(c.parcelaMensal)} (${c.parcelaAtivas} parcelamento(s) ativo(s))`,
    `Fatura do cartão: ${BRL(c.faturaCartao)}`,
    `Meta de guardar: ${BRL(c.guardar)}`,
    `Total de gastos: ${BRL(c.gastos)}`,
    `Sobra do mês: ${BRL(c.sobra)}`,
  ].join('\n');

  const detalhes = [
    'Renda extra (origem de cada ganho avulso deste mês):',
    listaDetalhada(state.rendaExtra, (it) => `${it.nome || 'Sem nome'}: ${BRL(toNumber(it.valor))}`),
    'Despesas fixas:',
    listaDetalhada(
      state.despesas,
      (it) => `${it.nome || 'Sem nome'}: ${BRL(toNumber(it.valor))}${it.venc ? ` (vence dia ${it.venc})` : ''}`
    ),
    'Assinaturas:',
    listaDetalhada(state.assinaturas, (it) => `${it.nome || 'Sem nome'}: ${BRL(toNumber(it.valor))}/mês`),
    'Compras no cartão:',
    listaDetalhada(
      state.cartao,
      (it) => `${it.nome || 'Sem nome'}: ${BRL(toNumber(it.valor))} [${catLabel(it.cat)}]`
    ),
    'Parcelamentos:',
    listaDetalhada(state.parcelamentos, (it) => {
      const p = computeParcela(it);
      return `${it.nome || 'Sem nome'}: total ${BRL(p.total)} em ${p.parc}x de ${BRL(p.mensal)} — ${p.pagas}/${p.parc} pagas${p.done ? ' (quitado)' : `, faltam ${BRL(p.falta)}`}`;
    }),
    'Metas de economia:',
    listaDetalhada(
      state.metas,
      (it) =>
        `${it.nome || 'Sem nome'}: alvo ${BRL(toNumber(it.valor))}, já guardado ${BRL(toNumber(it.guardado))}${it.prazo ? ` (prazo ${it.prazo})` : ''}`
    ),
  ].join('\n');

  return { tab: state.tab, tabLabel, categorias, resumo, detalhes };
}

const WELCOME =
  'Oi! Sou o assistente do DinPrev. Posso analisar seus gastos, dar dicas e lançar despesas ou receitas pra você. O que precisa?';

// Renderiza marcação inline (**negrito**, *itálico*, `código`) como nós React.
function renderInline(text, keyBase = '') {
  const nodes = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g;
  let last = 0;
  let match;
  let k = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(<strong key={`${keyBase}b${k++}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(<code key={`${keyBase}c${k++}`}>{token.slice(1, -1)}</code>);
    } else {
      nodes.push(<em key={`${keyBase}i${k++}`}>{token.slice(1, -1)}</em>);
    }
    last = regex.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// Converte o texto da IA (markdown simples) em blocos formatados.
function Markdown({ text }) {
  const lines = String(text).split('\n');
  const blocks = [];
  let list = null; // { ordered: bool, items: [] }

  const flush = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  lines.forEach((raw) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*(\d+)\.\s+(.*)$/);
    const heading = line.match(/^(#{1,4})\s+(.*)$/);

    if (bullet) {
      if (!list || list.ordered) {
        flush();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
    } else if (numbered) {
      if (!list || !list.ordered) {
        flush();
        list = { ordered: true, items: [] };
      }
      list.items.push(numbered[2]);
    } else if (heading) {
      flush();
      blocks.push({ type: 'h', level: heading[1].length, text: heading[2] });
    } else if (line.trim() === '') {
      flush();
    } else {
      flush();
      blocks.push({ type: 'p', text: line });
    }
  });
  flush();

  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === 'h') {
          const Tag = `h${Math.min(block.level + 2, 6)}`;
          return (
            <Tag key={i} className="ai-md-h">
              {renderInline(block.text, `h${i}`)}
            </Tag>
          );
        }
        if (block.type === 'p') {
          return <p key={i}>{renderInline(block.text, `p${i}`)}</p>;
        }
        const ListTag = block.ordered ? 'ol' : 'ul';
        return (
          <ListTag key={i}>
            {block.items.map((item, j) => (
              <li key={j}>{renderInline(item, `l${i}-${j}`)}</li>
            ))}
          </ListTag>
        );
      })}
    </>
  );
}

export default function AiAssistant({ state, c, onAction }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Imagem anexada aguardando envio (data URL) e flag de processamento do arquivo.
  const [image, setImage] = useState('');
  const [imgLoading, setImgLoading] = useState(false);
  // `history` é a lista completa enviada à IA (inclui mensagens de tool). A UI só
  // renderiza as de user/assistant com texto — ver `visible`.
  const [history, setHistory] = useState([]);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);

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

  // Lê a imagem escolhida, comprime e guarda como anexo pendente.
  async function pickImage(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite escolher o mesmo arquivo de novo
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Só dá pra anexar imagens por enquanto.');
      return;
    }
    setError('');
    setImgLoading(true);
    try {
      setImage(await fileToCompressedDataUrl(file));
    } catch (err) {
      console.error(err);
      setError('Não consegui carregar essa imagem.');
    } finally {
      setImgLoading(false);
    }
  }

  async function send() {
    const text = input.trim();
    if ((!text && !image) || busy || imgLoading) return;

    // Com imagem, o content vira um array (texto opcional + imagem); sem imagem,
    // continua sendo uma string simples.
    let content = text;
    if (image) {
      content = [];
      if (text) content.push({ type: 'text', text });
      content.push({ type: 'image_url', image_url: { url: image } });
    }

    setInput('');
    setImage('');
    setError('');
    setBusy(true);
    const next = [...history, { role: 'user', content }];
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
            {visible.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="ai-msg user">
                  <UserContent content={m.content} />
                </div>
              ) : (
                <div key={i} className="ai-msg bot ai-md">
                  <Markdown text={m.content} />
                </div>
              )
            )}
            {busy && (
              <div className="ai-msg bot ai-typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}
            {error && <div className="ai-msg error">{error}</div>}
          </div>

          {(image || imgLoading) && (
            <div className="ai-attach-preview">
              {imgLoading ? (
                <span className="ai-attach-loading">Carregando imagem…</span>
              ) : (
                <>
                  <img src={image} alt="Prévia do anexo" />
                  <button
                    className="ai-attach-remove"
                    onClick={() => setImage('')}
                    aria-label="Remover imagem"
                  >
                    <RiCloseLine />
                  </button>
                </>
              )}
            </div>
          )}

          <div className="ai-input-row">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={pickImage}
            />
            <button
              className="ai-attach"
              onClick={() => fileRef.current?.click()}
              disabled={busy || imgLoading}
              aria-label="Anexar imagem"
              title="Anexar imagem"
            >
              <RiImageAddLine />
            </button>
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
              disabled={busy || imgLoading || (!input.trim() && !image)}
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
