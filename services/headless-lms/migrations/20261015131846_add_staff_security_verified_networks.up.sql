ALTER TYPE user_email_code_purpose
ADD VALUE IF NOT EXISTS 'network_verification';

ALTER TYPE email_template_type
ADD VALUE IF NOT EXISTS 'verify_network';

CREATE TABLE staff_security_verified_browsers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_digest BYTEA NOT NULL UNIQUE CHECK (length(token_digest) = 32),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX staff_security_verified_browsers_user_id ON staff_security_verified_browsers (user_id);
CREATE INDEX staff_security_verified_browsers_expires_at ON staff_security_verified_browsers (expires_at);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON staff_security_verified_browsers FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE staff_security_verified_browsers IS 'Browsers a user with a role has confirmed with an emailed code. Half of the check that a staff session is really its owner: a session is recognized only from a remembered browser on a verified network. Expired rows are hard-deleted.';
COMMENT ON COLUMN staff_security_verified_browsers.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN staff_security_verified_browsers.user_id IS 'The user who verified this browser.';
COMMENT ON COLUMN staff_security_verified_browsers.token_digest IS 'SHA-256 of the random token in the browser''s cookie. The token itself is never stored.';
COMMENT ON COLUMN staff_security_verified_browsers.expires_at IS 'When the browser stops being remembered. Pushed forward when the browser is used.';
COMMENT ON COLUMN staff_security_verified_browsers.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN staff_security_verified_browsers.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';

CREATE TABLE staff_security_verified_networks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  network CIDR NOT NULL,
  country VARCHAR(16),
  verified_by_browser_id UUID REFERENCES staff_security_verified_browsers(id) ON DELETE SET NULL,
  verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Without a country there is nothing to bound a wider block by.
  CONSTRAINT staff_security_verified_networks_countryless_exact CHECK (
    country IS NOT NULL
    OR masklen(network) = CASE
      WHEN family(network) = 4 THEN 32
      ELSE 64
    END
  )
);
CREATE INDEX staff_security_verified_networks_user_id ON staff_security_verified_networks (user_id);
CREATE INDEX staff_security_verified_networks_expires_at ON staff_security_verified_networks (expires_at);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON staff_security_verified_networks FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE staff_security_verified_networks IS 'Networks from which a user with a role has confirmed with an emailed code. The other half of the check that a staff session is really its owner: a request is recognized when the user''s remembered browser comes from an address inside one of these networks, in the same country. Expired rows are hard-deleted.';
COMMENT ON COLUMN staff_security_verified_networks.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN staff_security_verified_networks.user_id IS 'The user who verified the network.';
COMMENT ON COLUMN staff_security_verified_networks.network IS 'The address block the verification covers. Starts as the IPv4 /16 or IPv6 /32 around the verifying address (exact /32 or /64 without a country), and may widen to at most /12 or /29 within 24 hours of verified_at.';
COMMENT ON COLUMN staff_security_verified_networks.country IS 'Lowercase country code of the verifying address. A request matches only from the same country. NULL when the address had no known country; such a row matches only addresses that have none either.';
COMMENT ON COLUMN staff_security_verified_networks.verified_by_browser_id IS 'The browser that last entered a code for this network. Only that browser may widen the network. NULL once that browser is forgotten.';
COMMENT ON COLUMN staff_security_verified_networks.verified_at IS 'When a code was last entered for this network. Widening is allowed only in the 24 hours after it.';
COMMENT ON COLUMN staff_security_verified_networks.expires_at IS 'When the network stops being recognized. Pushed forward when it is used close to expiry.';
COMMENT ON COLUMN staff_security_verified_networks.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN staff_security_verified_networks.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
