-- Separate from its use: a new enum value cannot be used in the transaction that adds it.
ALTER TYPE credit_registration_state
ADD VALUE IF NOT EXISTS 'partially_registered'
AFTER 'awaiting_verification';
