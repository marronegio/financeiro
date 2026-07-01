// Transcrição de áudio do assistente — proxy seguro para a OpenAI (Whisper).
//
// O frontend grava uma nota de voz (MediaRecorder) e manda o áudio em base64.
// Aqui transformamos em arquivo e chamamos o endpoint de transcrição da OpenAI,
// devolvendo só o texto. Esse texto volta pro chat como se o usuário tivesse
// digitado — o resto do fluxo (interpretar, lançar gasto) continua igual.
//
// A chave da OpenAI NUNCA vai para o frontend; fica como secret desta função:
//   supabase secrets set OPENAI_API_KEY=sk-...
// verify_jwt = true (config.toml): só usuário logado pode transcrever.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENAI_URL = 'https://api.openai.com/v1/audio/transcriptions'
// Modelo de transcrição. whisper-1 é barato e estável; dá pra trocar sem mexer
// no código: supabase secrets set OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
const MODEL = Deno.env.get('OPENAI_TRANSCRIBE_MODEL') || 'whisper-1'

// Limite defensivo do tamanho do áudio (~10 MB em base64 ≈ 7,5 MB de áudio).
const MAX_BASE64_LEN = 10 * 1024 * 1024

// Converte um data URL / base64 puro em bytes.
function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64
  const bin = atob(clean)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY não configurada.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { audio = '', mime = 'audio/webm' } = await req.json()
    if (!audio || typeof audio !== 'string') {
      return new Response(JSON.stringify({ error: 'Áudio ausente.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (audio.length > MAX_BASE64_LEN) {
      return new Response(JSON.stringify({ error: 'Áudio muito longo.' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Extensão coerente com o mime pra OpenAI reconhecer o formato.
    const ext = mime.includes('mp4') || mime.includes('mpeg') || mime.includes('m4a')
      ? 'mp4'
      : mime.includes('ogg')
        ? 'ogg'
        : mime.includes('wav')
          ? 'wav'
          : 'webm'

    const form = new FormData()
    form.append('file', new Blob([base64ToBytes(audio)], { type: mime }), `audio.${ext}`)
    form.append('model', MODEL)
    form.append('language', 'pt')

    const resp = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })

    if (!resp.ok) {
      const detail = await resp.text()
      console.error('Erro OpenAI (transcribe):', resp.status, detail)
      return new Response(JSON.stringify({ error: 'Falha ao transcrever o áudio.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await resp.json()
    return new Response(JSON.stringify({ text: (data.text || '').trim() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
