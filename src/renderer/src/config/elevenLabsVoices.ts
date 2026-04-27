/**
 * Default ElevenLabs voice IDs per PracticeCharacter id.
 *
 * These are well-known library voice IDs available on every ElevenLabs account
 * (no clone required). Picked to roughly fit each character's persona.
 *
 * Voice IDs are stable — sourced from elevenlabs.io/voice-library.
 */

// Diagnostic baseline: every character uses Rachel (21m00Tcm4TlvDq8ikWAM),
// the longest-standing free-tier voice. Once confirmed working on the user's
// account, expand to per-character voices using only those that respond 200 —
// we hit 402 paid_plan_required on Domi (AZnzlk1XvdvUeBnXmlld) so several of
// the previously-mapped library voices are likely Pro-only on this plan.
const RACHEL = '21m00Tcm4TlvDq8ikWAM'

export const ELEVEN_LABS_VOICES: Record<string, string> = {
  // ── Law domain ──
  trial_judge:     RACHEL,
  jury:            RACHEL,
  appellate_panel: RACHEL,
  supreme_court:   RACHEL,

  // ── Other domains (debate / theater / music / public speaking) ──
  faculty_jury:    RACHEL,
  evaluator_panel: RACHEL,
  opponent:        RACHEL,
  classroom:       RACHEL,
}

/** Fallback for any unmapped character.id. */
export const DEFAULT_VOICE_ID = RACHEL

export function voiceForCharacter(characterId: string): string {
  return ELEVEN_LABS_VOICES[characterId] ?? DEFAULT_VOICE_ID
}
