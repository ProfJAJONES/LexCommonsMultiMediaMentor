export interface VoiceOption {
  id: string
  name: string
}

/** Free-tier voices available on every ElevenLabs account. */
export const FREE_VOICES: VoiceOption[] = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (F)' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (M)' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni (M)' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh (M)' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold (M)' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam (M)' },
]

export const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Rachel

/**
 * Returns the voice ID for a given character, preferring any user override.
 * Falls back to Rachel (the most reliable free-tier voice).
 */
export function voiceForCharacter(characterId: string, overrides?: Record<string, string>): string {
  return overrides?.[characterId] ?? DEFAULT_VOICE_ID
}
