/* ======================================================================
 OAuth refresh-token reuse grace window
 ----------------------------------------------------------------------
 Adds `rotated_at` to `oauth_refresh_tokens`. It records the moment a
 refresh token was *superseded by rotation* (the refresh_token grant), as
 opposed to being hard-revoked (logout, fresh login, explicit revocation).

 This distinction powers a short reuse grace window: a refresh token that
 was rotated within the last ~60 seconds may be redeemed once more without
 triggering the family-wide revocation, so two clients racing a refresh
 (e.g. a shared/synced credential) both stay logged in for a bounded
 window instead of one immediately logging the other out.

 Invariants maintained in application code:
 - Rotation sets `rotated_at = now()` on the token being rotated.
 - Every hard-revoke path sets `rotated_at = NULL` alongside
   `revoked = true`, so a hard-revoked token can never be resurrected by
   the grace path.
 ====================================================================== */
BEGIN;

ALTER TABLE oauth_refresh_tokens
  ADD COLUMN rotated_at TIMESTAMPTZ;

COMMENT ON COLUMN oauth_refresh_tokens.rotated_at IS 'When this refresh token was superseded by rotation (NULL for active or hard-revoked tokens). Enables a short reuse grace window; cleared on hard revoke so revoked tokens are never resurrected.';

COMMIT;
