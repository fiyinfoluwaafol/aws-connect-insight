-- ============================================================
-- MIGRATION: Move key_moves to call_analyses
-- ============================================================

-- ============================================================
-- 1. ADD key_moves to call_analyses
-- ============================================================

-- Stores AI-identified agent techniques/actions for ALL calls
-- Array of strings, e.g. ["Acknowledged frustration early", "Offered clear next steps"]

ALTER TABLE call_analyses
  ADD COLUMN key_moves JSONB DEFAULT '[]';

-- ============================================================
-- 2. REMOVE key_moves from exemplar_calls
-- ============================================================

-- key_moves now lives in call_analyses, accessible via call_id join
-- Exemplars only need the note (supervisor's reason for marking)

ALTER TABLE exemplar_calls
  DROP COLUMN IF EXISTS key_moves;

-- ============================================================
-- 3. INDEXES (optional)
-- ============================================================

-- Uncomment if you plan to query by specific moves
-- CREATE INDEX idx_call_analyses_key_moves ON call_analyses USING GIN (key_moves);
