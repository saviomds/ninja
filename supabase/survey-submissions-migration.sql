-- ============================================================
-- TechNinja – Survey Submissions
-- Customer feedback / submission dashboard table
-- ============================================================

CREATE TABLE IF NOT EXISTS survey_submissions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_ref    TEXT        NOT NULL UNIQUE
                                DEFAULT ('SUB-' || upper(substring(gen_random_uuid()::text, 1, 8))),
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Respondent
  customer_name     TEXT,
  customer_email    TEXT,
  customer_phone    TEXT,

  -- Survey answers
  age_range         TEXT        CHECK (age_range IN ('18-24','25-34','35-44','45-54','55+')),
  device_category   TEXT        CHECK (device_category IN ('Smartphone','Laptop','Tablet','Desktop','Other')),
  satisfaction      SMALLINT    CHECK (satisfaction BETWEEN 1 AND 5),
  nps_score         SMALLINT    CHECK (nps_score BETWEEN 0 AND 10),
  avg_repair_time   TEXT,
  would_recommend   BOOLEAN,
  experience_note   TEXT,

  -- Internal admin workflow
  label             TEXT        NOT NULL DEFAULT 'new'
                                CHECK (label IN ('new','working','done','pending','flagged')),
  assignee_initials TEXT[],
  progress          SMALLINT    NOT NULL DEFAULT 0
                                CHECK (progress BETWEEN 0 AND 5),
  review_notes      TEXT,
  reviewed_by       TEXT,
  reviewed_at       TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Auto-update trigger ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _update_survey_submissions_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS survey_submissions_updated_at ON survey_submissions;
CREATE TRIGGER survey_submissions_updated_at
  BEFORE UPDATE ON survey_submissions
  FOR EACH ROW EXECUTE FUNCTION _update_survey_submissions_ts();

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE survey_submissions ENABLE ROW LEVEL SECURITY;

-- Admins (role set in user_metadata OR app_metadata) get full access
CREATE POLICY "admin_full_access_survey_submissions"
  ON survey_submissions FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Anonymous visitors can submit the survey form (INSERT only, no read-back)
CREATE POLICY "public_submit_survey"
  ON survey_submissions FOR INSERT
  TO anon
  WITH CHECK (true);

-- Authenticated non-admins can also submit (e.g. logged-in customers)
CREATE POLICY "user_submit_survey"
  ON survey_submissions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_survey_submissions_submitted_at
  ON survey_submissions (submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_survey_submissions_label
  ON survey_submissions (label);

CREATE INDEX IF NOT EXISTS idx_survey_submissions_customer_email
  ON survey_submissions (customer_email)
  WHERE customer_email IS NOT NULL;

-- ─── Seed data (dev/demo only — remove before production) ────────────────────
INSERT INTO survey_submissions
  (submission_ref, submitted_at, customer_name, age_range, device_category,
   satisfaction, nps_score, avg_repair_time, would_recommend, experience_note,
   label, assignee_initials, progress)
VALUES
  ('SUB-A1B2C3D4','2024-06-01 09:12:00+00','James Muthoni',  '25-34','Smartphone',4,8, 'Same day', true,  'The repair was done very quickly and staff were extremely professional throughout.',          'done',    ARRAY['D','H'], 5),
  ('SUB-C3D4E5F6','2024-06-02 11:30:00+00','Sophie Oduya',   '18-24','Laptop',    5,10,'2 hours',  true,  'Incredible service. My laptop screen was replaced in record time with quality parts.',        'done',    ARRAY['W'],     5),
  ('SUB-E5F6G7H8','2024-06-03 14:05:00+00','Kevin Njenga',   '35-44','Tablet',    3,6, '3 days',   false, 'Took a bit longer than expected but the quality of repair was acceptable overall.',         'pending', ARRAY['C'],     3),
  ('SUB-G7H8I9J0','2024-06-04 08:45:00+00','Amara Diallo',   '25-34','Smartphone',5,9, 'Same day', true,  'Very happy! Screen replacement done perfectly. Will definitely come back next time.',        'done',    ARRAY['D','N'], 5),
  ('SUB-I9J0K1L2','2024-06-05 16:20:00+00','Liam Ochieng',   '45-54','Desktop',   2,4, '1 week',   false, 'The repair took too long and I was not kept informed about any progress or delays.',        'flagged', ARRAY['H'],     2),
  ('SUB-K1L2M3N4','2024-06-06 10:00:00+00','Fatima Hassan',  '18-24','Smartphone',4,7, '4 hours',  true,  'Good service overall, though communication could be improved. Tech was knowledgeable.',     'working', ARRAY['C','W'], 3),
  ('SUB-M3N4O5P6','2024-06-07 13:15:00+00','Daniel Kimura',  '25-34','Laptop',    5,10,'Same day', true,  'Best tech repair experience I have ever had. Fast, affordable, and excellent quality.',       'done',    ARRAY['D'],     5),
  ('SUB-O5P6Q7R8','2024-06-08 09:30:00+00','Chloe Mensah',   '35-44','Tablet',    3,5, '2 days',   false, 'Average experience. The part replacement worked but my issue was not fully explained.',      'pending', ARRAY['N'],     2),
  ('SUB-Q7R8S9T0','2024-06-09 15:45:00+00','Marcus Adebayo', '18-24','Smartphone',5,9, '3 hours',  true,  'Staff were super helpful and even gave me tips on how to avoid future screen damage.',      'done',    ARRAY['W','H'], 5),
  ('SUB-S9T0U1V2','2024-06-10 11:00:00+00','Priya Gupta',    '25-34','Laptop',    4,8, 'Next day', true,  'Keyboard replacement was clean and the laptop feels brand new. Price was competitive.',     'working', ARRAY['C'],     4),
  ('SUB-U1V2W3X4','2024-06-11 08:00:00+00','Owen Kariuki',   '45-54','Smartphone',1,2, '5 days',   false, 'Very disappointed. Phone was returned with a different issue than it went in with.',        'flagged', ARRAY['D','C'], 1),
  ('SUB-W3X4Y5Z6','2024-06-12 14:30:00+00','Zoe Nakamura',   '18-24','Laptop',    5,10,'Same day', true,  'Came in with a broken charger port and left with a fully working laptop. Superb service.',  'new',     ARRAY['N'],     1),
  ('SUB-Y5Z6A7B8','2024-06-13 10:45:00+00','Isaac Nkosi',    '35-44','Smartphone',4,7, '2 hours',  true,  'Impressed with the speed. Drop-off and collection was seamless. Highly recommended.',       'working', ARRAY['W'],     3),
  ('SUB-A7B8C9D0','2024-06-14 16:00:00+00','Layla Osei',     '25-34','Desktop',   3,6, '3 days',   false, 'Repair was okay but expected a follow-up call that never came. Communication was lacking.', 'pending', ARRAY['H','N'], 2),
  ('SUB-C9D0E1F2','2024-06-15 12:00:00+00','Ethan Boateng',  '55+',  'Tablet',    5,9, 'Same day', true,  'Such a relief to find a team that actually knows what they are doing. Excellent job done.',  'new',     ARRAY['D','C'], 0)
ON CONFLICT (submission_ref) DO NOTHING;
