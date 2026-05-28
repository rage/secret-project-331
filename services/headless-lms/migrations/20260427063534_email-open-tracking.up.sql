CREATE TABLE email_opens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_delivery_id UUID NOT NULL REFERENCES email_deliveries(id),
  user_agent TEXT
);
CREATE INDEX ON email_opens (email_delivery_id);

CREATE TABLE email_link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_delivery_id UUID NOT NULL REFERENCES email_deliveries(id),
  destination_url TEXT NOT NULL,
  first_clicked_at TIMESTAMPTZ,
  click_count INT NOT NULL DEFAULT 0
);
CREATE INDEX ON email_link_clicks (email_delivery_id);
