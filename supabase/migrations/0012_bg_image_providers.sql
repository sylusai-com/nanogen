-- Background image provider API configuration table
-- Allows admins to configure and manage external image sources (e.g., Unsplash, Pexels)

CREATE TABLE IF NOT EXISTS bg_image_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL, -- 'unsplash', 'pexels', 'pixabay', 'custom', etc.
  api_key TEXT, -- encrypted API key or bearer token
  api_endpoint TEXT NOT NULL, -- e.g., https://api.unsplash.com/search/photos
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}', -- provider-specific config (page_size, orientation, etc.)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id),

  CONSTRAINT valid_type CHECK (type IN ('unsplash', 'pexels', 'pixabay', 'custom'))
);

-- RLS: Only admins can view/edit providers
ALTER TABLE bg_image_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bg_image_providers" ON bg_image_providers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can read enabled providers" ON bg_image_providers
  FOR SELECT USING (enabled = true);

-- Index for faster queries
CREATE INDEX idx_bg_image_providers_enabled ON bg_image_providers(enabled);
CREATE INDEX idx_bg_image_providers_type ON bg_image_providers(type);
