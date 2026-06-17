-- Create a table for background generation jobs so they survive serverless lifecycles and dev hot reloads
CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text UNIQUE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  status text NOT NULL,
  current_step jsonb,
  progress integer DEFAULT 0,
  steps_completed jsonb DEFAULT '[]'::jsonb,
  steps_skipped jsonb DEFAULT '[]'::jsonb,
  error text,
  error_details text,
  results jsonb DEFAULT '{}'::jsonb,
  banner jsonb,
  run_id uuid,
  banners jsonb DEFAULT '[]'::jsonb,
  variants jsonb DEFAULT '[]'::jsonb,
  payload jsonb,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- RLS policies
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own generation jobs"
ON public.generation_jobs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- System uses admin credentials to manage these rows, no further RLS needed.
