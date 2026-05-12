-- ============================================================
-- TechNinja Chat System — run this in Supabase SQL Editor
-- ============================================================

-- 1. Tables
CREATE TABLE IF NOT EXISTS chat_conversations (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at       timestamptz DEFAULT now(),
  last_message     text,
  last_message_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_participants (
  conversation_id  uuid REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id          uuid REFERENCES profiles(id)           ON DELETE CASCADE,
  last_read_at     timestamptz DEFAULT now(),
  joined_at        timestamptz DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id  uuid REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id        uuid REFERENCES profiles(id)           ON DELETE CASCADE,
  content          text NOT NULL,
  reply_to         uuid REFERENCES chat_messages(id),
  is_deleted       boolean DEFAULT false,
  created_at       timestamptz DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_chat_parts_user   ON chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_parts_convo  ON chat_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_msgs_convo   ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_msgs_created ON chat_messages(created_at);

-- 3. Grant table-level permissions to authenticated role
--    (Supabase does NOT auto-grant INSERT/UPDATE on new tables)
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_participants  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_messages      TO authenticated;

-- 4. Enable RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages      ENABLE ROW LEVEL SECURITY;

-- 5. Drop old policies if re-running
DROP POLICY IF EXISTS "view own conversations"               ON chat_conversations;
DROP POLICY IF EXISTS "create conversations"                 ON chat_conversations;
DROP POLICY IF EXISTS "update own conversations"             ON chat_conversations;
DROP POLICY IF EXISTS "view participants in my conversations" ON chat_participants;
DROP POLICY IF EXISTS "insert participants"                   ON chat_participants;
DROP POLICY IF EXISTS "update own participant row"            ON chat_participants;
DROP POLICY IF EXISTS "view messages in my conversations"    ON chat_messages;
DROP POLICY IF EXISTS "send messages in my conversations"    ON chat_messages;
DROP POLICY IF EXISTS "soft-delete own messages"             ON chat_messages;

-- 6. chat_conversations policies
CREATE POLICY "view own conversations"
  ON chat_conversations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE conversation_id = chat_conversations.id
        AND user_id = auth.uid()
    )
  );

-- INSERT: allow freely — participants are added right after
CREATE POLICY "create conversations"
  ON chat_conversations FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "update own conversations"
  ON chat_conversations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE conversation_id = chat_conversations.id
        AND user_id = auth.uid()
    )
  );

-- 7. chat_participants policies
-- Simple USING (true) for authenticated users avoids self-referencing
-- subquery recursion when other policies query this table.
CREATE POLICY "view participants in my conversations"
  ON chat_participants FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "insert participants"
  ON chat_participants FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "update own participant row"
  ON chat_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- 8. chat_messages policies
CREATE POLICY "view messages in my conversations"
  ON chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE conversation_id = chat_messages.conversation_id
        AND user_id = auth.uid()
    )
  );

-- Simplified INSERT: only verify sender — avoids nested RLS recursion.
-- The conversation must exist (FK) and the user must own the sender_id.
CREATE POLICY "send messages in my conversations"
  ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "soft-delete own messages"
  ON chat_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

-- 9. Enable Realtime (safe to re-run — checks before adding)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;
  END IF;
END $$;
