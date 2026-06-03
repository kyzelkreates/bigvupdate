/**
 * voiceGuidanceService.js — Browser Speech Synthesis voice guidance
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Uses Web Speech API (SpeechSynthesis) safely.
 * Safe to use on mobile and desktop browsers that support it.
 * Falls back gracefully if not supported.
 *
 * Voice rules:
 *   - Only speaks when instruction changes, not on every GPS update
 *   - Urgent warnings spoken once per unique warning id
 *   - Respects mute state
 *   - Stops speaking on navigation stop
 *   - Never loops speech
 *   - Never crashes if unsupported
 *
 * This is a stateless module — voice state is held in SSOT.
 * Module holds only the browser SpeechSynthesis reference.
 *
 * ADVISORY ONLY — never guarantees legal route compliance.
 */

// ─── Support check ────────────────────────────────────────────────────────────

export const VOICE_SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Get initial voice state for SSOT. */
export function getInitialVoiceState() {
  return {
    enabled:                false,
    muted:                  false,
    lastSpokenInstructionId: null,
    lastSpokenWarningId:    null,
    supported:              VOICE_SUPPORTED,
    error:                  null,
  };
}

// ─── Core speak functions ─────────────────────────────────────────────────────

/**
 * Speak an instruction string.
 * Safe to call even if voice is muted or unsupported.
 *
 * @param {string} text           - text to speak
 * @param {object} voiceState     - from SSOT { enabled, muted, supported }
 * @param {object} options        - { rate, pitch, volume, lang }
 * @returns {boolean} true if speech was started
 */
export function speakInstruction(text, voiceState, options = {}) {
  if (!shouldSpeak(voiceState)) return false;
  return _speak(text, { rate: 1.0, pitch: 1.0, volume: 1.0, lang: 'en-GB', ...options });
}

/**
 * Speak an urgent warning.
 * Interrupts current speech.
 */
export function speakWarning(text, voiceState, options = {}) {
  if (!shouldSpeak(voiceState)) return false;
  stopSpeaking();
  return _speak(text, { rate: 0.95, pitch: 1.05, volume: 1.0, lang: 'en-GB', ...options });
}

/**
 * Stop any current speech immediately.
 */
export function stopSpeaking() {
  if (!VOICE_SUPPORTED) return;
  try { window.speechSynthesis.cancel(); } catch {}
}

/**
 * Mute voice — stops any current speech.
 * Returns updated partial voice state for SSOT.
 */
export function muteVoice() {
  stopSpeaking();
  return { muted: true };
}

/**
 * Unmute voice.
 * Returns updated partial voice state for SSOT.
 */
export function unmuteVoice() {
  return { muted: false };
}

/**
 * Enable voice guidance.
 * Returns updated partial voice state for SSOT.
 */
export function setVoiceEnabled(enabled) {
  if (!enabled) stopSpeaking();
  return { enabled: Boolean(enabled) };
}

/**
 * Repeat the last instruction.
 * Requires text to be passed in since we don't hold state.
 */
export function repeatLastInstruction(text, voiceState) {
  if (!text) return false;
  const state = { ...voiceState, muted: false };   // repeat ignores mute
  stopSpeaking();
  return _speak(text, { rate: 0.95, pitch: 1.0, volume: 1.0, lang: 'en-GB' });
}

/**
 * Called when navigation stops — silences all voice.
 */
export function onNavigationStop() {
  stopSpeaking();
}

// ─── Smart trigger (call from App.jsx on GPS updates) ─────────────────────────

/**
 * Evaluate whether a new instruction should be spoken, and speak it.
 * Returns { spoken: bool, updatedVoiceState: partial } for SSOT merge.
 *
 * Call this on every instruction-change event (not every GPS tick).
 */
export function triggerInstructionVoice({
  instructionText,
  instructionId,
  voiceState,
}) {
  if (!shouldSpeak(voiceState)) {
    return { spoken: false, updatedVoiceState: null };
  }

  // Don't repeat the same instruction id
  if (instructionId && instructionId === voiceState?.lastSpokenInstructionId) {
    return { spoken: false, updatedVoiceState: null };
  }

  if (!instructionText) return { spoken: false, updatedVoiceState: null };

  stopSpeaking();
  const ok = _speak(instructionText, { rate: 1.0, pitch: 1.0, volume: 1.0, lang: 'en-GB' });

  return {
    spoken: ok,
    updatedVoiceState: ok ? { lastSpokenInstructionId: instructionId } : null,
  };
}

/**
 * Evaluate whether a warning should be spoken.
 */
export function triggerWarningVoice({ warningText, warningId, voiceState }) {
  if (!shouldSpeak(voiceState)) return { spoken: false, updatedVoiceState: null };
  if (warningId && warningId === voiceState?.lastSpokenWarningId) {
    return { spoken: false, updatedVoiceState: null };
  }
  stopSpeaking();
  const ok = _speak(warningText, { rate: 0.95, pitch: 1.05, volume: 1.0, lang: 'en-GB' });
  return {
    spoken: ok,
    updatedVoiceState: ok ? { lastSpokenWarningId: warningId } : null,
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function shouldSpeak(voiceState) {
  if (!VOICE_SUPPORTED)        return false;
  if (!voiceState?.enabled)    return false;
  if (voiceState?.muted)       return false;
  return true;
}

function _speak(text, { rate = 1.0, pitch = 1.0, volume = 1.0, lang = 'en-GB' } = {}) {
  if (!VOICE_SUPPORTED || !text) return false;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate   = rate;
    utterance.pitch  = pitch;
    utterance.volume = volume;
    utterance.lang   = lang;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.warn('[voiceGuidanceService] Speech synthesis error:', err);
    return false;
  }
}
