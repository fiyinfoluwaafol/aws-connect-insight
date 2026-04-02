-- ============================================================
-- MIGRATION: Drop legacy alert rule columns
-- ============================================================

ALTER TABLE alert_configurations
  DROP COLUMN IF EXISTS sentiment_threshold,
  DROP COLUMN IF EXISTS keyword_id;
