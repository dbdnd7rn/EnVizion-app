-- Cover remaining care chat and family-help foreign keys.
-- Safe for existing records; does not change roles, RLS, or clinical data.
CREATE INDEX IF NOT EXISTS idx_chat_message_audit_message_id
  ON private.chat_message_audit (message_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_created_by
  ON public.chat_conversations (created_by);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_direct_user_a
  ON public.chat_conversations (direct_user_a);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_direct_user_b
  ON public.chat_conversations (direct_user_b);
CREATE INDEX IF NOT EXISTS idx_chat_typing_state_user_id
  ON public.chat_typing_state (user_id);
CREATE INDEX IF NOT EXISTS idx_family_help_offers_reviewed_by
  ON public.family_help_offers (reviewed_by);
