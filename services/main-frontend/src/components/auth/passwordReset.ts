import { millisecondsInMinute } from "date-fns/constants"

/** Mirrors the token lifetime set in headless-lms `models/src/user_passwords.rs`. */
export const RESET_LINK_LIFETIME_HOURS = 1

/**
 * Mirrors `RESET_MAIL_MIN_INTERVAL_MINUTES` in headless-lms `server/src/controllers/main_frontend/users.rs`:
 * the server silently skips a reset email sent this soon after the previous one.
 */
export const RESET_EMAIL_RESEND_COOLDOWN_MINUTES = 5

export const RESET_EMAIL_RESEND_COOLDOWN_MS =
  RESET_EMAIL_RESEND_COOLDOWN_MINUTES * millisecondsInMinute
