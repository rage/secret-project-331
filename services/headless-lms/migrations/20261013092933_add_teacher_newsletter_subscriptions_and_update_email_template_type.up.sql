CREATE TABLE teacher_newsletter_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  user_id UUID NOT NULL REFERENCES users,
  subscribed BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TYPE email_template_type
ADD VALUE 'teacher_newsletter';
