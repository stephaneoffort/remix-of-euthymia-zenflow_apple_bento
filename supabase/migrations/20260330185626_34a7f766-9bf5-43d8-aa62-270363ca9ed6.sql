DROP TABLE IF EXISTS google_chat_messages CASCADE;
DROP TABLE IF EXISTS google_chat_connections CASCADE;
DROP TABLE IF EXISTS chat_bot_commands CASCADE;

DELETE FROM member_integrations WHERE integration = 'google_chat';