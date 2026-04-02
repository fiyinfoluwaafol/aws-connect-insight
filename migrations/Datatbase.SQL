-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('agent', 'supervisor');
CREATE TYPE sentiment_label AS ENUM ('positive', 'neutral', 'negative');
CREATE TYPE alert_type AS ENUM (
  'sentiment_threshold',
  'keyword_match',
  'recurring_topic',
  'recurring_keyword'
);
CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high');
CREATE TYPE alert_status AS ENUM ('open', 'closed');
CREATE TYPE notification_type AS ENUM ('alert', 'coaching_tip', 'exemplar_added');
CREATE TYPE notification_reference_type AS ENUM ('call', 'alert', 'coaching_tip', 'exemplar_call');

-- ============================================================
-- 1. USERS
-- Extends Supabase auth.users
-- ============================================================

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  role user_role NOT NULL,
  team_id UUID, -- FK added after teams table is created
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 2. TEAMS
-- ============================================================

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  supervisor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Now add the FK from users -> teams
ALTER TABLE users
  ADD CONSTRAINT fk_users_team
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

-- ============================================================
-- 3. CALLS
-- ============================================================

CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  recording_url TEXT,
  transcript JSONB, -- Array of {speaker, text} objects
  duration_seconds INTEGER,
  started_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 4. CALL ANALYSES
-- ============================================================

CREATE TABLE call_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL UNIQUE REFERENCES calls(id) ON DELETE CASCADE,
  summary TEXT,
  sentiment_score DECIMAL(4, 3) CHECK (sentiment_score BETWEEN -1.0 AND 1.0),
  sentiment_label sentiment_label,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 5. TOPICS
-- ============================================================

CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 6. KEYWORDS
-- ============================================================

CREATE TABLE keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word VARCHAR(100) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 7. CALL ANALYSIS TOPICS (Join Table)
-- ============================================================

CREATE TABLE call_analysis_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_analysis_id UUID NOT NULL REFERENCES call_analyses(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  UNIQUE (call_analysis_id, topic_id)
);

-- ============================================================
-- 8. CALL ANALYSIS KEYWORDS (Join Table)
-- ============================================================

CREATE TABLE call_analysis_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_analysis_id UUID NOT NULL REFERENCES call_analyses(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  UNIQUE (call_analysis_id, keyword_id)
);

-- ============================================================
-- 9. ALERT CONFIGURATIONS
-- ============================================================

CREATE TABLE alert_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  type alert_type NOT NULL,
  severity alert_severity NOT NULL DEFAULT 'medium',
  sentiment_below DECIMAL(4, 3) CHECK (sentiment_below BETWEEN -1.0 AND 1.0),
  keyword VARCHAR(100),
  topic VARCHAR(100),
  min_occurrences INTEGER NOT NULL DEFAULT 3,
  window_days INTEGER NOT NULL DEFAULT 7,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 10. ALERTS
-- ============================================================

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES alert_configurations(id) ON DELETE SET NULL,
  supervisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  type alert_type NOT NULL DEFAULT 'sentiment_threshold',
  status alert_status NOT NULL DEFAULT 'open',
  severity alert_severity NOT NULL,
  title VARCHAR(255),
  description TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  matched_value VARCHAR(100),
  matched_count INTEGER,
  window_days INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 11. EXEMPLAR CALLS
-- ============================================================

CREATE TABLE exemplar_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL UNIQUE REFERENCES calls(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  marked_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  note TEXT,
  key_moves JSONB, -- Array of strings describing what made the call great
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 12. COACHING TIPS
-- ============================================================

CREATE TABLE coaching_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content JSONB NOT NULL, -- Array of tip strings
  reason TEXT, -- Why the tip was generated
  based_on_call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  helpful BOOLEAN, -- Agent feedback - was tip useful?
  bookmarked BOOLEAN DEFAULT FALSE,
  dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 13. NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  reference_type notification_reference_type,
  reference_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 14. BRIEFS
-- ============================================================

CREATE TABLE briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  generated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_calls INTEGER DEFAULT 0,
  average_sentiment DECIMAL(4, 3),
  positive_call_percentage DECIMAL(5, 2),
  negative_call_percentage DECIMAL(5, 2),
  top_issues JSONB,
  content JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_teams_updated_at
  BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_call_analyses_updated_at
  BEFORE UPDATE ON call_analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_alert_configurations_updated_at
  BEFORE UPDATE ON alert_configurations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_alerts_updated_at
  BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- INDEXES (for common query patterns)
-- ============================================================

CREATE INDEX idx_users_team_id ON users(team_id);
CREATE INDEX idx_calls_agent_id ON calls(agent_id);
CREATE INDEX idx_calls_team_id ON calls(team_id);
CREATE INDEX idx_calls_started_at ON calls(started_at);
CREATE INDEX idx_call_analyses_call_id ON call_analyses(call_id);
CREATE INDEX idx_call_analysis_topics_analysis_id ON call_analysis_topics(call_analysis_id);
CREATE INDEX idx_call_analysis_keywords_analysis_id ON call_analysis_keywords(call_analysis_id);
CREATE INDEX idx_alerts_supervisor_id ON alerts(supervisor_id);
CREATE INDEX idx_alerts_team_id ON alerts(team_id);
CREATE INDEX idx_coaching_tips_agent_id ON coaching_tips(agent_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_briefs_team_id ON briefs(team_id);
