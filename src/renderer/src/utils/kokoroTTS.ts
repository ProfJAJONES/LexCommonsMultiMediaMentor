/**
 * kokoroTTS — local TTS via kokoro-js (Kokoro-82M, q8, ~82 MB).
 * Downloads from HuggingFace on first use, cached in browser storage.
 * Falls back silently to browser SpeechSynthesis on any failure.
 */

export interface KokoroVoiceOption {
  id: string
  name: string
}

export const KOKORO_VOICES: KokoroVoiceOption[] = [
  { id: 'af_heart',   name: 'Heart (American F)'  },
  { id: 'af_bella',   name: 'Bella (American F)'  },
  { id: 'af_nicole',  name: 'Nicole (American F)' },
  { id: 'am_adam',    name: 'Adam (American M)'   },
  { id: 'am_michael', name: 'Michael (American M)'},
  { id: 'bf_emma',    name: 'Emma (British F)'    },
  { id: 'bm_george',  name: 'George (British M)'  },
]

export const DEFAULT_KOKORO_VOICE = 'af_heart'

export type KokoroStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface KokoroProgress {
  status: KokoroStatus
  /** 0–100 download progress, or 100 when ready */
  pct: number
}

type ProgressCb = (p: KokoroProgress) => void

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _tts: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _promise: Promise<any> | null = null
let _status: KokoroStatus = 'idle'
const _listeners = new Set<ProgressCb>()

function emit(pct: number, status: KokoroStatus) {
  _status = status
  _listeners.forEach(cb => cb({ pct, status }))
}

async function load() {
  if (_tts) return _tts
  if (_promise) return _promise
  _promise = (async () => {
    emit(0, 'loading')
    try {
      const { KokoroTTS } = await import('kokoro-js')
      const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0', {
        dtype: 'q8',
        progress_callback: (info: Record<string, unknown>) => {
          if (info.status === 'progress' && typeof info.progress === 'number') {
            emit(Math.round(info.progress as number), 'loading')
          }
        }
      })
      _tts = tts
      emit(100, 'ready')
      return tts
    } catch (e) {
      _promise = null
      emit(0, 'error')
      throw e
    }
  })()
  return _promise
}

export function getKokoroStatus(): KokoroStatus { return _status }

export function onKokoroProgress(cb: ProgressCb): () => void {
  _listeners.add(cb)
  cb({ pct: _status === 'ready' ? 100 : 0, status: _status })
  return () => { _listeners.delete(cb) }
}

/** Begin loading in background (no-op if already loaded/loading). */
export function preloadKokoro(): void { load().catch(() => {}) }

let _src: AudioBufferSourceNode | null = null
let _ctx: AudioContext | null = null

export function cancelKokoro(): void {
  try { _src?.stop() } catch { /* ok */ }
  _src = null
  try { _ctx?.close() } catch { /* ok */ }
  _ctx = null
}

export async function speakKokoro(text: string, voice = DEFAULT_KOKORO_VOICE): Promise<void> {
  cancelKokoro()
  const tts = await load()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: { audio: any; sampling_rate: number } = await tts.generate(text.trim(), { voice })

  const ctx = new AudioContext({ sampleRate: result.sampling_rate })
  _ctx = ctx
  const buf = ctx.createBuffer(1, result.audio.length, result.sampling_rate)
  buf.copyToChannel(result.audio, 0)
  const src = ctx.createBufferSource()
  _src = src
  src.buffer = buf
  src.connect(ctx.destination)

  await new Promise<void>(resolve => {
    src.onended = () => {
      try { ctx.close() } catch { /* ok */ }
      _src = null
      _ctx = null
      resolve()
    }
    src.start()
  })
}
