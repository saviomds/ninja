-- ============================================================
-- TechNinja Chat — RLS Fix (run this in Supabase SQL Editor)
-- Drops ALL existing policies on chat tables, then recreates
-- simple non-recursive ones.
-- ============================================================

-- Step 1: Drop every policy on the three tables (catches any
--         leftover policies regardless of name)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_participants'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON chat_participants', pol.policyname);
  END LOOP;

  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON chat_messages', pol.policyname);
  END LOOP;

  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_conversations'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON chat_conversations', pol.policyname);
  END LOOP;
END $$;

-- Step 2: Make sure RLS is on (safe to re-run)
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages      ENABLE ROW LEVEL SECURITY;

-- Step 3: Make sure grants are in place
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_participants  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_messages      TO authenticated;

-- Step 4: chat_conversations policies
CREATE POLICY "conv_select"
  ON chat_conversations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE conversation_id = chat_conversations.id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "conv_insert"
  ON chat_conversations FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "conv_update"
  ON chat_conversations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE conversation_id = chat_conversations.id
        AND user_id = auth.uid()
    )
  );

-- Step 5: chat_participants policies — SIMPLE, no recursion
-- SELECT (true) avoids self-referencing subquery that causes recursion
CREATE POLICY "part_select"
  ON chat_participants FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "part_insert"
  ON chat_participants FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "part_update"
  ON chat_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Step 6: chat_messages policies
-- SELECT: check participation (safe — chat_participants SELECT is now USING(true))
CREATE POLICY "msg_select"
  ON chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE conversation_id = chat_messages.conversation_id
        AND user_id = auth.uid()
    )
  );

-- INSERT: only verify sender_id — no nested participant check needed
CREATE POLICY "msg_insert"
  ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- UPDATE: only own messages (soft-delete)
CREATE POLICY "msg_update"
  ON chat_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

-- Step 7: Realtime publication (safe to re-run)
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
