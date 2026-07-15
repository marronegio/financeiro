import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  RiSparkling2Line,
  RiCloseLine,
  RiSendPlaneFill,
  RiImageAddLine,
  RiMicLine,
  RiStopFill,
  RiPlayFill,
  RiPauseFill,
} from 'react-icons/ri';
import { supabase } from '../lib/supabase.js';
import { BRL, toNumber, computeParcela } from '../money.js';
import { getCardCategories, TABS } from '../state.js';

// Segurança contra loop infinito de ferramentas numa mesma pergunta.
const MAX_TOOL_ROUNDS = 5;

// Invoca uma Edge Function de IA e normaliza os erros. Quando o backend responde
// não-2xx (ex.: 429 de créditos de IA esgotados), o supabase-js devolve um
// FunctionsHttpError com o corpo em `context` — lemos o JSON de lá pra saber o
// código (`err.code`) e a mensagem amigável a exibir.
async function invokeAi(name, body) {
  const { data, error: fnError } = await supabase.functions.invoke(name, { body });
  if (fnError) {
    let detail = null;
    try {
      detail = await fnError.context?.json();
    } catch {
      /* corpo não-JSON (erro de rede/relay): segue com a mensagem genérica */
    }
    const err = new Error(detail?.message || detail?.error || fnError.message);
    err.code = detail?.error || '';
    throw err;
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

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

// Escolhe um formato de gravação suportado pelo navegador (Chrome/Firefox usam
// webm/opus; Safari/iOS caem no mp4).
function pickAudioMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

// Converte um Blob de áudio em base64 puro (sem o prefixo data:).
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o áudio.'));
    reader.onload = () => {
      const url = reader.result;
      resolve(url.slice(url.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

// Remove campos só de exibição (ex: audioUrl) antes de mandar pra API da OpenAI,
// que rejeita propriedades desconhecidas nas mensagens.
function toApiMessage(m) {
  const out = { role: m.role, content: m.content };
  if (m.tool_calls) out.tool_calls = m.tool_calls;
  if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
  if (m.name) out.name = m.name;
  return out;
}

const fmtTime = (s) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

// Player de áudio estilo WhatsApp: botão play/pause, waveform clicável e tempo.
function VoiceMessage({ src }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  // Alturas fixas das barrinhas da waveform (visual, não é o áudio real).
  const bars = useMemo(
    () => Array.from({ length: 34 }, () => 0.3 + Math.random() * 0.7),
    []
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      const t = audio.currentTime || 0;
      if (t < 1e100) setCurrent(t); // ignora o valor gigante do hack de duração
    };
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    // Blobs do MediaRecorder às vezes vêm com duration = Infinity; forçar o
    // currentTime obriga o navegador a calcular a duração real.
    const onLoaded = () => {
      if (audio.duration === Infinity || Number.isNaN(audio.duration)) {
        audio.currentTime = 1e101;
      } else {
        setDuration(audio.duration);
      }
    };
    const onDurationChange = () => {
      if (audio.duration !== Infinity && !Number.isNaN(audio.duration)) {
        setDuration(audio.duration);
        if (audio.currentTime > 1e100) audio.currentTime = 0;
      }
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('durationchange', onDurationChange);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('durationchange', onDurationChange);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  };

  const seek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrent(ratio * duration);
  };

  const progress = duration ? current / duration : 0;
  const shown = playing || current > 0 ? current : duration;

  return (
    <div className="ai-voice">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button className="ai-voice-btn" onClick={toggle} aria-label={playing ? 'Pausar' : 'Tocar'}>
        {playing ? <RiPauseFill /> : <RiPlayFill />}
      </button>
      <div className="ai-voice-wave" onClick={seek}>
        {bars.map((h, i) => (
          <span
            key={i}
            className={`ai-voice-bar${(i + 0.5) / bars.length <= progress ? ' on' : ''}`}
            style={{ height: `${Math.round(h * 100)}%` }}
          />
        ))}
      </div>
      <span className="ai-voice-time">{fmtTime(shown)}</span>
    </div>
  );
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
    `Doações: ${BRL(c.totDoacoes)}`,
    `Compras no cartão: ${BRL(c.totCartao)}`,
    `Parcela do mês: ${BRL(c.parcelaMensal)} (${c.parcelaAtivas} parcelamento(s) ativo(s)${
      c.parcelaMensalPix > 0 ? `; ${BRL(c.parcelaMensalPix)} via Pix, fora da fatura` : ''
    })`,
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
    'Doações:',
    listaDetalhada(
      state.doacoes,
      (it) => `${it.nome || 'Sem nome'}: ${BRL(toNumber(it.valor))}${it.recorrente ? ' (recorrente)' : ''}`
    ),
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

const WELCOME = 'Como posso ajudar?';

// Sugestões de primeira mensagem — aparecem só no início da conversa e são
// enviadas como se o usuário tivesse digitado.
const SUGGESTIONS = [
  'Lançar um gasto no cartão',
  'Resumo dos meus gastos do mês',
  'Quanto ainda posso gastar?',
  'Dicas pra economizar',
];

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

// `open`/`onOpenChange` (opcionais) permitem controlar o painel de fora — o
// BottomNav do app nativo usa isso no botão central. `hideFab` esconde o botão
// flutuante quando outro botão já faz esse papel.
export default function AiAssistant({
  state, c, onAction, tourActive = false,
  hideFab = false, open: openProp, onOpenChange,
}) {
  const controlled = openProp !== undefined;
  const [openState, setOpenState] = useState(false);
  const open = controlled ? openProp : openState;
  const setOpen = (next) => {
    const v = typeof next === 'function' ? next(open) : next;
    if (controlled) onOpenChange?.(v);
    else setOpenState(v);
  };
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Imagem anexada aguardando envio (data URL) e flag de processamento do arquivo.
  const [image, setImage] = useState('');
  const [imgLoading, setImgLoading] = useState(false);
  // Gravação de voz: `recording` enquanto captura, `transcribing` durante a
  // transcrição na OpenAI.
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  // `history` é a lista completa enviada à IA (inclui mensagens de tool). A UI só
  // renderiza as de user/assistant com texto — ver `visible`.
  const [history, setHistory] = useState([]);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, open, busy]);

  // Campo de mensagem estilo WhatsApp: começa com 1 linha e cresce conforme o
  // texto quebra, até o teto (max-height do CSS); daí em diante rola por dentro.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const max = 120; // mantém em sincronia com o max-height de .ai-input
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, max) + 'px';
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, [input, open]);

  // Uma "rodada" com a IA: manda o histórico + contexto, aplica as ferramentas
  // que ela pedir e repete até vir uma resposta em texto (ou estourar o limite).
  async function converse(messages) {
    let convo = messages;
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const data = await invokeAi('ai-assistant', {
        messages: convo.map(toApiMessage),
        context: buildContext(state, c),
      });

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

  // Envia um texto pronto (botões de sugestão) como se o usuário tivesse digitado.
  async function sendText(text) {
    if (busy || imgLoading || recording || transcribing) return;
    setError('');
    setBusy(true);
    const next = [...history, { role: 'user', content: text }];
    setHistory(next);
    try {
      await converse(next);
    } catch (err) {
      console.error(err);
      setError(
        err.code === 'limit_reached'
          ? err.message
          : 'Não consegui responder agora. Tente de novo em instantes.'
      );
    } finally {
      setBusy(false);
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
      setError(
        err.code === 'limit_reached'
          ? err.message
          : 'Não consegui responder agora. Tente de novo em instantes.'
      );
    } finally {
      setBusy(false);
    }
  }

  // Envia o áudio como mensagem de voz (tipo WhatsApp): mostra o player no chat e
  // transcreve nos bastidores pra IA entender o conteúdo e já responder.
  async function sendAudio(blob, mime) {
    if (busy) return;
    setTranscribing(true);
    setError('');
    let text = '';
    let audioB64 = '';
    try {
      audioB64 = await blobToBase64(blob);
      const data = await invokeAi('ai-transcribe', { audio: audioB64, mime });
      text = (data.text || '').trim();
    } catch (err) {
      console.error(err);
      setError(
        err.code === 'limit_reached'
          ? err.message
          : 'Não consegui processar o áudio. Tente de novo.'
      );
      setTranscribing(false);
      return;
    }
    setTranscribing(false);
    if (!text) {
      setError('Não entendi o áudio. Tente falar de novo.');
      return;
    }

    // A mensagem guarda o áudio (só pra exibir) e o texto transcrito (o que a IA
    // realmente lê). O `audioUrl` é removido antes de ir pra API — ver `converse`.
    const audioUrl = `data:${mime};base64,${audioB64}`;
    setBusy(true);
    const next = [...history, { role: 'user', content: text, audioUrl }];
    setHistory(next);
    try {
      await converse(next);
    } catch (err) {
      console.error(err);
      setError(
        err.code === 'limit_reached'
          ? err.message
          : 'Não consegui responder agora. Tente de novo em instantes.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    if (busy || transcribing) return;
    const mime = pickAudioMime();
    if (!navigator.mediaDevices?.getUserMedia || !mime) {
      setError('Seu navegador não suporta gravação de áudio.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size > 0) sendAudio(blob, mime);
      };
      recorderRef.current = recorder;
      recorder.start();
      setError('');
      setRecording(true);
    } catch (err) {
      console.error(err);
      setError('Não consegui acessar o microfone. Verifique a permissão.');
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  const toggleRecording = () => (recording ? stopRecording() : startRecording());

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
      {!hideFab && (
        <button
          className={`ai-fab${tourActive ? ' ai-fab-tour' : ''}`}
          data-tour="ai-fab"
          onClick={() => setOpen((v) => !v)}
          disabled={tourActive}
          aria-label="Abrir o Mr. Din, assistente de IA"
          title="Mr. Din — assistente de IA"
        >
          {open ? <RiCloseLine /> : <RiSparkling2Line />}
        </button>
      )}

      {open && (
        <div className="ai-panel" role="dialog" aria-label="Mr. Din — assistente de IA">
          <div className="ai-head">
            <span className="ai-head-title">
              <RiSparkling2Line /> Mr. Din
            </span>
            <button className="ai-close" onClick={() => setOpen(false)} aria-label="Fechar">
              <RiCloseLine />
            </button>
          </div>

          <div className="ai-msgs" ref={scrollRef}>
            <div className="ai-msg bot">{WELCOME}</div>
            {visible.length === 0 && !busy && (
              <div className="ai-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="ai-suggest" onClick={() => sendText(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {visible.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="ai-msg user">
                  {m.audioUrl ? (
                    <div className="ai-msg-audio">
                      <VoiceMessage src={m.audioUrl} />
                      {typeof m.content === 'string' && m.content && (
                        <span className="ai-audio-caption">{m.content}</span>
                      )}
                    </div>
                  ) : (
                    <UserContent content={m.content} />
                  )}
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
              disabled={busy || imgLoading || recording}
              aria-label="Anexar imagem"
              title="Anexar imagem"
            >
              <RiImageAddLine />
            </button>
            <button
              className={`ai-attach ai-mic${recording ? ' recording' : ''}`}
              onClick={toggleRecording}
              disabled={busy || transcribing}
              aria-label={recording ? 'Parar gravação' : 'Gravar áudio'}
              title={recording ? 'Parar gravação' : 'Gravar áudio'}
            >
              {recording ? <RiStopFill /> : <RiMicLine />}
            </button>
            <textarea
              className="ai-input"
              ref={inputRef}
              rows={1}
              placeholder={
                recording
                  ? 'Gravando… toque para parar'
                  : transcribing
                    ? 'Transcrevendo áudio…'
                    : 'Ex: gastei 45 no mercado'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={busy || recording || transcribing}
            />
            <button
              className="ai-send"
              onClick={send}
              disabled={busy || imgLoading || recording || transcribing || (!input.trim() && !image)}
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
