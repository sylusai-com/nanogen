-- Background removal provider configuration table
-- Mirrors bg_image_providers in shape but holds vendors that strip the
-- background off a subject image (remove.bg, ClipDrop, Photoroom, custom
-- self-hosted endpoints, etc.). The pipeline picks the first enabled
-- provider; when no provider is configured a local Sharp-based fallback
-- handles studio-style portraits with near-uniform backgrounds.

CREATE TABLE IF NOT EXISTS bg_removal_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL,
  api_key TEXT,
  api_endpoint TEXT,
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id),

  CONSTRAINT valid_removal_type CHECK (type IN ('removebg', 'clipdrop', 'photoroom', 'custom'))
);

ALTER TABLE bg_removal_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bg_removal_providers" ON bg_removal_providers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can read enabled bg_removal_providers" ON bg_removal_providers
  FOR SELECT USING (enabled = true);

CREATE INDEX idx_bg_removal_providers_enabled ON bg_removal_providers(enabled);
CREATE INDEX idx_bg_removal_providers_type ON bg_removal_providers(type);
