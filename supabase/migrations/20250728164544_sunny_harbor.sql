/*
  # Create competitions table

  1. New Tables
    - `competitions`
      - `id` (uuid, primary key, default gen_random_uuid())
      - `title` (text, not null)
      - `description` (text, nullable)
      - `organizer_id` (uuid, references profiles.id)
      - `start_date` (timestamptz, not null)
      - `end_date` (timestamptz, not null)
      - `registration_deadline` (timestamptz, not null)
      - `max_participants` (integer, nullable)
      - `status` (text, enum: 'draft', 'published', 'active', 'completed', default 'draft')
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `competitions` table
    - Add policy for organizers to manage their own competitions
    - Add policy for public read access to published competitions
    - Add policy for authenticated users to read published competitions

  3. Constraints
    - Ensure end_date is after start_date
    - Ensure registration_deadline is before start_date
*/

-- Create competitions table
CREATE TABLE IF NOT EXISTS competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  organizer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  registration_deadline timestamptz NOT NULL,
  max_participants integer,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'active', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_date_range CHECK (end_date > start_date),
  CONSTRAINT valid_registration_deadline CHECK (registration_deadline <= start_date)
);

-- Enable RLS
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Organizers can manage own competitions"
  ON competitions
  FOR ALL
  TO authenticated
  USING (organizer_id = auth.uid());

CREATE POLICY "Public can read published competitions"
  ON competitions
  FOR SELECT
  TO anon
  USING (status = 'published');

CREATE POLICY "Authenticated users can read published competitions"
  ON competitions
  FOR SELECT
  TO authenticated
  USING (status = 'published' OR organizer_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER competitions_updated_at
  BEFORE UPDATE ON competitions
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS competitions_organizer_id_idx ON competitions(organizer_id);
CREATE INDEX IF NOT EXISTS competitions_status_idx ON competitions(status);
CREATE INDEX IF NOT EXISTS competitions_start_date_idx ON competitions(start_date);