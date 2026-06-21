-- ============================================================
-- TechNinja – Platform Features Migration
-- Appointments · Blog Posts · Public Repair Tracker Policies
-- ============================================================

-- ─── Appointments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref            TEXT NOT NULL UNIQUE DEFAULT ('APT-' || upper(substring(gen_random_uuid()::text, 1, 8))),
  customer_name  TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  service_type   TEXT NOT NULL,
  device_brand   TEXT,
  device_model   TEXT,
  issue_description TEXT,
  preferred_date DATE NOT NULL,
  preferred_time TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','confirmed','in_progress','completed','cancelled')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Blog Posts ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_posts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  excerpt        TEXT,
  content        TEXT NOT NULL,
  category       TEXT NOT NULL DEFAULT 'tips',
  author         TEXT NOT NULL DEFAULT 'Tech Ninja',
  featured_image TEXT,
  read_time      INTEGER DEFAULT 5,
  published      BOOLEAN NOT NULL DEFAULT false,
  published_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts   ENABLE ROW LEVEL SECURITY;

-- Appointments: anyone can book, admin (authenticated) manages everything
CREATE POLICY "public_insert_appointments"  ON appointments FOR INSERT                   WITH CHECK (true);
CREATE POLICY "auth_all_appointments"       ON appointments FOR ALL TO authenticated     USING (true) WITH CHECK (true);

-- Blog: public reads published posts only; admin manages everything
CREATE POLICY "public_read_published_blogs" ON blog_posts FOR SELECT USING (published = true);
CREATE POLICY "auth_all_blog_posts"         ON blog_posts FOR ALL TO authenticated       USING (true) WITH CHECK (true);

-- Repair Tracker: public can read tickets + history by ticket_no knowledge
CREATE POLICY "public_read_repair_tickets"  ON repair_tickets        FOR SELECT TO anon  USING (true);
CREATE POLICY "public_read_repair_history"  ON repair_status_history FOR SELECT TO anon  USING (true);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_appointments_date     ON appointments(preferred_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status   ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_phone    ON appointments(customer_phone);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug       ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published  ON blog_posts(published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category   ON blog_posts(category);

-- ─── Seed Blog Posts ──────────────────────────────────────────────────────────
INSERT INTO blog_posts (slug, title, excerpt, content, category, author, read_time, published, published_at) VALUES
(
  'how-to-extend-your-iphone-battery-life',
  '7 Proven Ways to Extend Your iPhone Battery Life',
  'Battery draining too fast? These tested tips will dramatically improve how long your iPhone lasts between charges.',
  'Is your iPhone dying before the end of the day? You''re not alone. Battery degradation and bad habits are the two biggest culprits. Here are 7 things you can do right now.

**1. Enable Low Power Mode**
Go to Settings > Battery > Low Power Mode. This reduces background activity and can add hours to your day.

**2. Check Battery Health**
Settings > Battery > Battery Health & Charging. If it''s below 80%, it''s time for a replacement. Tech Ninja can swap your battery in under 30 minutes.

**3. Reduce Screen Brightness**
Your display is the biggest power drain. Drop brightness to 50% and enable Auto-Brightness.

**4. Turn Off Background App Refresh**
Settings > General > Background App Refresh. Set it to "Off" or "Wi-Fi Only".

**5. Disable Location Services for Non-Essential Apps**
Settings > Privacy > Location Services. Apps like games and shopping apps don''t need your location.

**6. Use Wi-Fi Instead of Cellular**
Wi-Fi uses significantly less power than LTE or 5G. Connect to trusted networks whenever possible.

**7. Avoid Extreme Temperatures**
iPhones perform best between 16°C–22°C. Heat degrades battery chemistry permanently.

If you''ve tried all these and still struggling, your battery may simply be worn out. A quality battery replacement at Tech Ninja costs from Rs 800 and comes with a 2-year warranty.',
  'tips', 'Tech Ninja', 6, true, now() - interval '2 days'
),
(
  'signs-your-phone-screen-needs-replacement',
  '5 Signs Your Phone Screen Needs Immediate Replacement',
  'A damaged screen isn''t just cosmetic — it can get worse fast. Know the warning signs before your display fails completely.',
  'That small crack in the corner might seem harmless, but phone screens can deteriorate rapidly once damaged. Here''s what to watch for.

**1. Visible Cracks or Shattered Glass**
The most obvious sign. Even hairline cracks can compromise the digitizer underneath, affecting touch response over time.

**2. Dead Zones — Areas That Won''t Respond to Touch**
If certain areas of your screen don''t respond, the digitizer layer is damaged. This will worsen, not improve.

**3. Black or Colored Lines Running Across the Display**
These indicate damage to the LCD or OLED panel beneath the glass. A phone that''s been dropped hard often shows this.

**4. Discoloration or Dark Spots**
Pressure damage from drops or sitting on your phone can cause internal LCD bleeding — the dark blotchy patches.

**5. Display Flickering or Going Completely Dark**
Connection issues between the display cable and motherboard, often caused by impact, cause intermittent flickering.

**The Cost of Waiting**
Cracks allow dust and moisture to enter the device. A screen that costs Rs 1,500 to replace today could lead to a Rs 5,000 water damage repair if ignored.

Tech Ninja offers screen replacements for all major brands starting from Rs 1,500, completed in 1–2 hours with genuine parts and a 2-year warranty.',
  'repair', 'Tech Ninja', 4, true, now() - interval '5 days'
),
(
  'laptop-running-slow-fix-it',
  'Why Is My Laptop Running Slow? 6 Fixes That Actually Work',
  'A slow laptop doesn''t always need replacing. These targeted fixes restore performance without spending a fortune.',
  'A sluggish laptop is frustrating, but in most cases it''s fixable without buying a new machine. Here''s what''s actually causing the slowdown and how to fix it.

**1. Too Many Startup Programs**
Open Task Manager (Windows) or System Preferences > Users > Login Items (Mac). Disable everything you don''t need running at startup.

**2. Full Hard Drive**
If your storage is over 85% full, performance tanks. Delete old files, empty the trash, and move photos to external storage or cloud.

**3. Old Mechanical Hard Drive (HDD)**
This is the single biggest performance upgrade available. Replacing a spinning HDD with an SSD makes a laptop feel like new. Boot times go from 2 minutes to 15 seconds.

**4. Insufficient RAM**
8GB is the minimum for modern use. If you''re running 4GB, upgrading to 8GB or 16GB is inexpensive and dramatically improves multitasking.

**5. Overheating**
A laptop that throttles its CPU to stay cool will feel impossibly slow. Dust buildup in the fan and vents is usually the cause. A professional cleaning fixes this.

**6. Malware or Bloatware**
Run a full antivirus scan. Remove manufacturer-installed software you''ve never used.

**When to See a Professional**
If your laptop is making grinding noises (dying HDD), running extremely hot, or crashing randomly, bring it in. Tech Ninja offers full diagnostics for free — we''ll tell you exactly what''s wrong and what it costs to fix it, no obligation.',
  'how-to', 'Tech Ninja', 5, true, now() - interval '8 days'
)
ON CONFLICT (slug) DO NOTHING;
