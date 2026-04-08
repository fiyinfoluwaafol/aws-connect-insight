-- ============================================================
-- MIGRATION: Expand alerting engine for rule-based automation
-- ============================================================

-- ============================================================
-- 1. EXTEND alert_type enum with new rule and alert values
-- ============================================================

DO $$
BEGIN
  ALTER TYPE alert_type ADD VALUE 'sentiment_threshold';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE alert_type ADD VALUE 'keyword_match';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE alert_type ADD VALUE 'recurring_topic';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE alert_type ADD VALUE 'recurring_keyword';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. EXPAND alert_configurations for backend-first rules engine
-- ============================================================

ALTER TABLE alert_configurations
  ADD COLUMN IF NOT EXISTS severity alert_severity NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS sentiment_below DECIMAL(4, 3),
  ADD COLUMN IF NOT EXISTS keyword VARCHAR(100),
  ADD COLUMN IF NOT EXISTS topic VARCHAR(100),
  ADD COLUMN IF NOT EXISTS min_occurrences INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS window_days INTEGER NOT NULL DEFAULT 7;

CREATE INDEX IF NOT EXISTS idx_alert_configurations_team_id
  ON alert_configurations(team_id);

CREATE INDEX IF NOT EXISTS idx_alert_configurations_supervisor_id
  ON alert_configurations(supervisor_id);

CREATE INDEX IF NOT EXISTS idx_alert_configurations_is_active
  ON alert_configurations(is_active);

-- ============================================================
-- 3. EXPAND alerts table for recurring alerts and rule tracing
-- ============================================================

ALTER TABLE alerts
  ALTER COLUMN call_id DROP NOT NULL;

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS rule_id UUID REFERENCES alert_configurations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS matched_value VARCHAR(100),
  ADD COLUMN IF NOT EXISTS matched_count INTEGER,
  ADD COLUMN IF NOT EXISTS window_days INTEGER;

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS status alert_status NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS type alert_type NOT NULL DEFAULT 'sentiment_threshold';

DO $$
BEGIN
  ALTER TABLE alerts DROP CONSTRAINT alerts_call_id_key;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_rule_call_unique
  ON alerts(rule_id, call_id)
  WHERE call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alerts_rule_id
  ON alerts(rule_id);

CREATE INDEX IF NOT EXISTS idx_alerts_matched_value
  ON alerts(matched_value);

CREATE INDEX IF NOT EXISTS idx_alerts_status
  ON alerts(status);

CREATE INDEX IF NOT EXISTS idx_alerts_type
  ON alerts(type);
