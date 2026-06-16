-- ============================================================
-- TechNinja – New Features Migration
-- Repair Tickets · Phone Grading · Loyalty Program
-- ============================================================

-- ─── Repair Tickets ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS repair_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no       TEXT NOT NULL UNIQUE,
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT,
  customer_email  TEXT,
  device_brand    TEXT NOT NULL,
  device_model    TEXT NOT NULL,
  device_serial   TEXT,
  device_color    TEXT,
  issue_description TEXT NOT NULL,
  priority        TEXT DEFAULT 'normal'
                  CHECK (priority IN ('low','normal','high','urgent')),
  status          TEXT DEFAULT 'received'
                  CHECK (status IN ('received','diagnosed','in_repair','waiting_parts','ready','delivered','cancelled')),
  technician      TEXT,
  estimated_cost  DECIMAL(10,2),
  final_cost      DECIMAL(10,2),
  estimated_completion DATE,
  notes           TEXT,
  invoice_id      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER repair_tickets_updated_at
  BEFORE UPDATE ON repair_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Status history for audit trail
CREATE TABLE IF NOT EXISTS repair_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid REFERENCES repair_tickets(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  notes       TEXT,
  changed_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Phone Grading ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phone_grades (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_ref       TEXT NOT NULL UNIQUE,
  customer_name   TEXT,
  customer_phone  TEXT,
  device_brand    TEXT NOT NULL,
  device_model    TEXT NOT NULL,
  device_serial   TEXT,
  device_imei     TEXT,
  storage_capacity TEXT,
  color           TEXT,
  -- Cosmetic checks
  screen_condition TEXT CHECK (screen_condition IN ('perfect','minor_scratch','crack','shatter')),
  back_condition  TEXT CHECK (back_condition IN ('perfect','minor_scratch','crack','shatter')),
  frame_condition TEXT CHECK (frame_condition IN ('perfect','minor_dent','bent','broken')),
  -- Functional checks (null = not tested)
  battery_health  INTEGER CHECK (battery_health BETWEEN 0 AND 100),
  face_id_works   BOOLEAN,
  fingerprint_works BOOLEAN,
  speakers_work   BOOLEAN,
  microphone_works BOOLEAN,
  front_camera_works BOOLEAN,
  rear_camera_works BOOLEAN,
  charging_works  BOOLEAN,
  wifi_works      BOOLEAN,
  cellular_works  BOOLEAN,
  buttons_work    BOOLEAN,
  screen_touch_works BOOLEAN,
  -- Result
  grade           TEXT CHECK (grade IN ('A+','A','B','C','D','F')),
  trade_in_value  DECIMAL(10,2),
  notes           TEXT,
  graded_by       TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─── Loyalty Program ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT NOT NULL UNIQUE,
  customer_email  TEXT,
  points_balance  INTEGER DEFAULT 0 CHECK (points_balance >= 0),
  tier            TEXT DEFAULT 'bronze'
                  CHECK (tier IN ('bronze','silver','gold','platinum')),
  total_earned    INTEGER DEFAULT 0,
  total_redeemed  INTEGER DEFAULT 0,
  member_since    TIMESTAMPTZ DEFAULT now(),
  last_activity   TIMESTAMPTZ DEFAULT now(),
  is_active       BOOLEAN DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  type            TEXT NOT NULL
                  CHECK (type IN ('earn','redeem','bonus','adjustment','expire')),
  points          INTEGER NOT NULL,
  balance_after   INTEGER NOT NULL,
  description     TEXT NOT NULL,
  reference_id    TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─── RLS Policies ─────────────────────────────────────────────────────────────
ALTER TABLE repair_tickets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_grades          ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions  ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (admin-only app)
CREATE POLICY "auth_all_repair_tickets"        ON repair_tickets        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_repair_status_history" ON repair_status_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_phone_grades"          ON phone_grades          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_loyalty_accounts"      ON loyalty_accounts      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_loyalty_transactions"  ON loyalty_transactions  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_repair_tickets_status    ON repair_tickets(status);
CREATE INDEX IF NOT EXISTS idx_repair_tickets_created   ON repair_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repair_status_ticket     ON repair_status_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_phone_grades_created     ON phone_grades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_phone   ON loyalty_accounts(customer_phone);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_acct ON loyalty_transactions(account_id);
