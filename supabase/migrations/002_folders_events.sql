-- ══════════════════════════════════════════════════
-- PART 1: Dynamic folders
-- ══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  cloudinary_path text NOT NULL,
  tipo text DEFAULT 'general',
  created_at timestamptz DEFAULT now()
);

-- Seed base folders
INSERT INTO folders (name, slug, cloudinary_path, tipo) VALUES
  ('Bodas', 'bodas', 'maralma/bodas', 'general'),
  ('Corporativo', 'corporativo', 'maralma/corporativo', 'general'),
  ('Privados', 'privados', 'maralma/privados', 'general'),
  ('Platos', 'platos', 'maralma/platos', 'general'),
  ('Hero', 'hero', 'maralma/hero', 'general'),
  ('Equipo', 'equipo', 'maralma/equipo', 'general'),
  ('Recursos', 'recursos', 'maralma/recursos', 'general')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_folders" ON folders
  FOR SELECT USING (true);

CREATE POLICY "admin_write_folders" ON folders
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ══════════════════════════════════════════════════
-- PART 2: Events gallery
-- ══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  subtitulo text,
  tipo text NOT NULL,
  fecha date,
  ubicacion text,
  descripcion text,
  cover_url text,
  cover_public_id text,
  slug text UNIQUE NOT NULL,
  publicado boolean DEFAULT false,
  orden int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  url text NOT NULL,
  public_id text NOT NULL,
  alt_text text,
  orden int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_events" ON events
  FOR SELECT USING (publicado = true);

CREATE POLICY "admin_all_events" ON events
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "public_read_event_images" ON event_images
  FOR SELECT USING (true);

CREATE POLICY "admin_all_event_images" ON event_images
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
