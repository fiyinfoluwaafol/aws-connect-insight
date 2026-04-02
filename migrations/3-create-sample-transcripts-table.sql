-- ============================================================
-- MIGRATION: Create sample_transcripts table
-- ============================================================

-- ============================================================
-- SAMPLE_TRANSCRIPTS TABLE
-- ============================================================
-- Stores sample transcript data for testing/training purposes
-- Not linked to any other tables - standalone collection

CREATE TABLE sample_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript JSONB NOT NULL -- Array of {speaker, text} objects
);
