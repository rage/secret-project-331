CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_verification_token VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    code VARCHAR(6) NOT NULL,
    code_sent BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT email_verification_token_length CHECK (LENGTH(email_verification_token) >= 128)
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_email_verification_token 
ON email_verification_tokens(email_verification_token) 
WHERE deleted_at IS NULL AND used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at 
ON email_verification_tokens(expires_at);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON email_verification_tokens FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE email_verification_tokens IS 'Stores email verification tokens and codes for two-step authentication. Expired records are automatically filtered in queries and randomly cleaned up (1 in 10 chance) to prevent table bloat.';
COMMENT ON COLUMN email_verification_tokens.id IS 'A unique identifier for this token record';
COMMENT ON COLUMN email_verification_tokens.email_verification_token IS 'Long random string token (minimum 128 characters) returned to frontend for verification';
COMMENT ON COLUMN email_verification_tokens.user_id IS 'References the user this token belongs to';
COMMENT ON COLUMN email_verification_tokens.code IS 'One-time 6-digit verification code sent via email';
COMMENT ON COLUMN email_verification_tokens.code_sent IS 'Whether the email with code has been sent';
COMMENT ON COLUMN email_verification_tokens.expires_at IS 'Time after which the token and code become invalid (default 15 minutes)';
COMMENT ON COLUMN email_verification_tokens.used_at IS 'Time when the token was successfully used. Null if unused.';
COMMENT ON COLUMN email_verification_tokens.created_at IS 'Time when the token was created.';
COMMENT ON COLUMN email_verification_tokens.updated_at IS 'Time when the record was last updated. Automatically set by trigger.';
COMMENT ON COLUMN email_verification_tokens.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
