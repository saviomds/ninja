-- ============================================================
-- Table: newsletter_subscribers
-- ============================================================
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text        NOT NULL UNIQUE,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  is_active     boolean     NOT NULL DEFAULT true
);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Block all read/update/delete for non-service roles
DROP POLICY IF EXISTS "service role only" ON newsletter_subscribers;
CREATE POLICY "service role only"
  ON newsletter_subscribers
  FOR ALL
  USING (false);

-- Allow anyone to subscribe (INSERT)
DROP POLICY IF EXISTS "allow subscribe" ON newsletter_subscribers;
CREATE POLICY "allow subscribe"
  ON newsletter_subscribers
  FOR INSERT
  WITH CHECK (true);
