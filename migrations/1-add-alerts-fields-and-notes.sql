-- ============================================================
-- MIGRATION: Add alert fields + notes table
-- ============================================================

-- ============================================================
-- 1. UPDATE EXISTING ENUM + ADD NEW ENUM
-- ============================================================

-- Add 'manual' to existing alert_type enum
ALTER TYPE alert_type ADD VALUE 'manual';

-- Create alert_status enum
CREATE TYPE alert_status AS ENUM ('open', 'closed');

-- ============================================================
-- 2. ALTER ALERTS TABLE - Add new columns
-- ============================================================

ALTER TABLE alerts
  ADD COLUMN type alert_type NOT NULL DEFAULT 'threshold',
  ADD COLUMN status alert_status NOT NULL DEFAULT 'open',
  ADD COLUMN title VARCHAR(255),
  ADD COLUMN description TEXT;

-- ============================================================
-- 3. CREATE NOTES TABLE
-- ============================================================

CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 4. INDEXES
-- ============================================================

CREATE INDEX idx_notes_call_id ON notes(call_id);
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_type ON alerts(type);
