/*
  # Create skill proofs table

  1. New Tables
    - `skill_proofs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `proof_type` (text, 'github_repo' or 'file_upload')
      - `proof_data` (jsonb, stores URL or file info)
      - `evaluation_status` (text, 'pending', 'completed', 'failed')
      - `evaluated_tier` (text, skill tier result)
      - `evaluation_details` (jsonb, stores OpenAI response)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `skill_proofs` table
    - Add policies for users to manage their own proofs
    - Add policy for reading completed evaluations

  3. Constraints
    - Valid proof types
    - Valid evaluation statuses
    - Valid skill tiers
*/

CREATE TABLE IF NOT EXISTS skill_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  proof_type text NOT NULL CHECK (proof_type IN ('github_repo', 'file_upload')),
  proof_data jsonb NOT NULL,
  evaluation_status text NOT NULL DEFAULT 'pending' CHECK (evaluation_status IN ('pending', 'completed', 'failed')),
  evaluated_tier text CHECK (evaluated_tier IN ('beginner', 'intermediate', 'advanced', 'expert')),
  evaluation_details jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE skill_proofs ENABLE ROW LEVEL SECURITY;

-- Users can manage their own skill proofs
CREATE POLICY "Users can manage own skill proofs"
  ON skill_proofs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Public can read completed evaluations for team matching
CREATE POLICY "Public can read completed evaluations"
  ON skill_proofs
  FOR SELECT
  TO authenticated
  USING (evaluation_status = 'completed');

-- Add indexes for performance
CREATE INDEX skill_proofs_user_id_idx ON skill_proofs(user_id);
CREATE INDEX skill_proofs_status_idx ON skill_proofs(evaluation_status);

-- Add updated_at trigger
CREATE TRIGGER skill_proofs_updated_at
  BEFORE UPDATE ON skill_proofs
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();