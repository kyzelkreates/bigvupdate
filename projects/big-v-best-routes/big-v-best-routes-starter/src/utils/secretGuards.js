/**
 * secretGuards.js — 4P3X API Config Guard™
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Blocks backend/server secrets from being entered in frontend settings.
 * Masks saved keys in the UI.
 * Never logs full keys.
 *
 * ADVISORY ONLY — security features are best-effort client-side guards.
 */

// ─── Blocked secret names ────────────────────────────────────────────────────

const BLOCKED_SECRET_NAMES = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GROQ_API_KEY',
  'STRIPE_SECRET_KEY',
  'DATABASE_URL',
  'JWT_SECRET',
  'PRIVATE_KEY',
  'WEBHOOK_SECRET',
  'ADMIN_TOKEN',
  'SERVICE_ROLE',
  'ROOT_TOKEN',
  'GOOGLE_MAPS_SERVER_KEY',
  'GOOGLE_SERVICE_ACCOUNT_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'MAPBOX_SECRET_TOKEN',
  'MAPBOX_DOWNLOADS_TOKEN',
];

// Patterns that suggest a value is a backend/server secret
const SECRET_VALUE_PATTERNS = [
  /^sk-[A-Za-z0-9]{20,}/,            // OpenAI-style secret
  /^sk_live_[A-Za-z0-9]{20,}/,       // Stripe live key
  /^sk_test_[A-Za-z0-9]{20,}/,       // Stripe test key
  /^supabase\.[a-z]+\.service/i,      // Supabase service role pattern
  /^eyJ[A-Za-z0-9._-]{30,}/,         // JWT token
  /^AKIA[0-9A-Z]{16}/,               // AWS access key
  /^[A-Za-z0-9+/]{88}={0,2}$/,       // Base64-encoded credentials (88+ chars)
];

// Mapbox: distinguish public (pk.) from secret (sk.) tokens
const MAPBOX_SECRET_PATTERN = /^sk\./;
const MAPBOX_PUBLIC_PATTERN  = /^pk\./;

/**
 * Check if a secret name is blocked.
 * @param {string} nameOrValue
 * @returns {{ blocked: boolean, reason: string | null }}
 */
export function detectForbiddenSecretName(nameOrValue) {
  if (!nameOrValue || typeof nameOrValue !== 'string') {
    return { blocked: false, reason: null };
  }
  const upper = nameOrValue.toUpperCase().trim();
  for (const blocked of BLOCKED_SECRET_NAMES) {
    if (upper.includes(blocked)) {
      return {
        blocked: true,
        reason:  `"${blocked}" is a backend/server secret and cannot be stored in frontend settings.`,
      };
    }
  }
  return { blocked: false, reason: null };
}

/**
 * Check if a value looks like a backend/server secret.
 * @param {string} value
 * @returns {{ blocked: boolean, reason: string | null }}
 */
export function detectForbiddenSecretValue(value) {
  if (!value || typeof value !== 'string') return { blocked: false, reason: null };

  // Mapbox: explicitly block secret tokens
  if (MAPBOX_SECRET_PATTERN.test(value.trim())) {
    return {
      blocked: true,
      reason:  'This looks like a Mapbox secret token (sk.*). Only public tokens (pk.*) are allowed in frontend settings.',
    };
  }

  for (const pattern of SECRET_VALUE_PATTERNS) {
    if (pattern.test(value.trim())) {
      return {
        blocked: true,
        reason:  'This looks like a backend/server secret and cannot be stored in frontend settings.',
      };
    }
  }

  return { blocked: false, reason: null };
}

/**
 * Validate a Mapbox public token.
 * Returns { valid: boolean, reason: string | null }
 */
export function validateMapboxToken(token) {
  if (!token) return { valid: false, reason: 'Mapbox public token is required.' };
  if (MAPBOX_SECRET_PATTERN.test(token.trim())) {
    return { valid: false, reason: 'Secret Mapbox tokens (sk.*) are not allowed. Use your public token (pk.*) only.' };
  }
  if (!MAPBOX_PUBLIC_PATTERN.test(token.trim())) {
    return { valid: false, reason: 'Invalid Mapbox token format. Should start with pk.' };
  }
  return { valid: true, reason: null };
}

/**
 * Mask an API key/token for display.
 * Returns "abcd****7890" format — always safe to render.
 * Never throws — returns "••••••" on any error.
 *
 * @param {string} secret
 * @param {number} showStart - chars to show at start (default 4)
 * @param {number} showEnd   - chars to show at end (default 4)
 */
export function maskSecret(secret, showStart = 4, showEnd = 4) {
  if (!secret || typeof secret !== 'string') return '';
  const s = secret.trim();
  if (s.length <= showStart + showEnd) return '••••••';
  const start = s.slice(0, showStart);
  const end   = s.slice(-showEnd);
  return `${start}****${end}`;
}

/**
 * Safe version — never returns the real secret, only masked form.
 * Use this anywhere a key needs to be displayed.
 */
export function safeMaskedDisplay(secret) {
  if (!secret) return '';
  return maskSecret(secret);
}

/**
 * Run all guards on a key/value before saving.
 * Returns { ok: boolean, error: string | null }
 *
 * @param {string} value      - the API key or token value
 * @param {string} fieldLabel - human label for the field (for error messages)
 */
export function guardBeforeSave(value, fieldLabel = 'API key') {
  if (!value) return { ok: true, error: null };  // empty is fine — disables the provider

  const nameCheck = detectForbiddenSecretName(value);
  if (nameCheck.blocked) {
    return { ok: false, error: `${fieldLabel}: ${nameCheck.reason}` };
  }

  const valueCheck = detectForbiddenSecretValue(value);
  if (valueCheck.blocked) {
    return { ok: false, error: `${fieldLabel}: ${valueCheck.reason}` };
  }

  return { ok: true, error: null };
}
