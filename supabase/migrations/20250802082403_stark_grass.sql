/*
  # Competition Automation Schema

  1. New Tables
    - `competition_participants` - tracks who joined each competition with their repo URLs
    - `commit_metrics` - stores daily commit counts and percentages per participant
    - `prize_distributions` - final prize calculations and payouts

  2. Security
    - Enable RLS on all new tables
    - Add policies for participants to read own data
    - Add policies for organizers to read competition data

  3. Indexes
    - Performance indexes for competition queries
    - Composite indexes for efficient metric lookups
*/

-- Competition participants table
CREATE TABLE IF NOT EXISTS competition_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  repo_url text NOT NULL,
  joined_at timestamptz DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'disqualified')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(competition_id, participant_id)
);

-- Commit metrics table for daily tracking
CREATE TABLE IF NOT EXISTS commit_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  commit_count integer DEFAULT 0,
  commit_percentage decimal(5,2) DEFAULT 0.00,
  total_competition_commits integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(competition_id, participant_id, date)
);

-- Prize distributions table
CREATE TABLE IF NOT EXISTS prize_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_commits integer DEFAULT 0,
  commit_percentage decimal(5,2) DEFAULT 0.00,
  prize_amount decimal(10,2) DEFAULT 0.00,
  prize_pool_total decimal(10,2) DEFAULT 0.00,
  calculated_at timestamptz DEFAULT now(),
  paid_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(competition_id, participant_id)
);

-- Add prize pool to competitions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'competitions' AND column_name = 'prize_pool'
  ) THEN
    ALTER TABLE competitions ADD COLUMN prize_pool decimal(10,2) DEFAULT 0.00;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS competition_participants_competition_idx ON competition_participants(competition_id);
CREATE INDEX IF NOT EXISTS competition_participants_participant_idx ON competition_participants(participant_id);
CREATE INDEX IF NOT EXISTS commit_metrics_competition_date_idx ON commit_metrics(competition_id, date);
CREATE INDEX IF NOT EXISTS commit_metrics_participant_date_idx ON commit_metrics(participant_id, date);
CREATE INDEX IF NOT EXISTS prize_distributions_competition_idx ON prize_distributions(competition_id);

-- Enable RLS
ALTER TABLE competition_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE commit_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE prize_distributions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for competition_participants
CREATE POLICY "Participants can read own participation"
  ON competition_participants
  FOR SELECT
  TO authenticated
  USING (participant_id = auth.uid());

CREATE POLICY "Participants can insert own participation"
  ON competition_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (participant_id = auth.uid());

CREATE POLICY "Organizers can read competition participants"
  ON competition_participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM competitions
      WHERE competitions.id = competition_participants.competition_id
      AND competitions.organizer_id = auth.uid()
    )
  );

-- RLS Policies for commit_metrics
CREATE POLICY "Participants can read own metrics"
  ON commit_metrics
  FOR SELECT
  TO authenticated
  USING (participant_id = auth.uid());

CREATE POLICY "Organizers can read competition metrics"
  ON commit_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM competitions
      WHERE competitions.id = commit_metrics.competition_id
      AND competitions.organizer_id = auth.uid()
    )
  );

CREATE POLICY "System can manage all metrics"
  ON commit_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for prize_distributions
CREATE POLICY "Participants can read own prizes"
  ON prize_distributions
  FOR SELECT
  TO authenticated
  USING (participant_id = auth.uid());

CREATE POLICY "Organizers can read competition prizes"
  ON prize_distributions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM competitions
      WHERE competitions.id = prize_distributions.competition_id
      AND competitions.organizer_id = auth.uid()
    )
  );

CREATE POLICY "System can manage all prizes"
  ON prize_distributions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER competition_participants_updated_at
  BEFORE UPDATE ON competition_participants
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER commit_metrics_updated_at
  BEFORE UPDATE ON commit_metrics
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER prize_distributions_updated_at
  BEFORE UPDATE ON prize_distributions
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();