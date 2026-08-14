-- Separate indexes so that the user_id OR anonymous_token lookup can be served with a BitmapOr.
CREATE INDEX chatbot_conversations_user_id ON chatbot_conversations (user_id);

CREATE INDEX chatbot_conversations_anonymous_token ON chatbot_conversations (anonymous_token);
