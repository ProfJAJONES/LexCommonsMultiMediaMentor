/**
 * Default ElevenLabs voice IDs per PracticeCharacter id.
 *
 * These are well-known library voice IDs available on every ElevenLabs account
 * (no clone required). Picked to roughly fit each character's persona.
 *
 * Voice IDs are stable — sourced from elevenlabs.io/voice-library.
 */

export const ELEVEN_LABS_VOICES: Record<string, string> = {
  // ── Law domain ──
  trial_judge:     'pNInz6obpgDQGcFmaJgB', // Adam — deep, authoritative
  jury:            'EXAVITQu4vr4xnSDxMAh', // Bella — warm, conversational
  appellate_panel: 'onwK4e9ZLuTAKqWW03F9', // Daniel — measured, BBC newscaster
  supreme_court:   'XB0fDUnXU5powFXDhCwa', // Charlotte — calm, gravitas

  // ── Other domains (debate / theater / music / public speaking) ──
  faculty_jury:    'AZnzlk1XvdvUeBnXmlld', // Domi — engaged, expressive
  evaluator_panel: '21m00Tcm4TlvDq8ikWAM', // Rachel — clear, even-tempered
  opponent:        'VR6AewLTigWG4xSOukaG', // Arnold — confrontational
  classroom:       'pNInz6obpgDQGcFmaJgB', // Adam — fallback
}

/** Fallback for any unmapped character.id. */
export const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Rachel

export function voiceForCharacter(characterId: string): string {
  return ELEVEN_LABS_VOICES[characterId] ?? DEFAULT_VOICE_ID
}
