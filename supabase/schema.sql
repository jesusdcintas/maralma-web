-- =============================================
-- Maralma - Schema de base de datos (Supabase)
-- =============================================

-- Textos editables de la web
create table content (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- Galería de imágenes (URLs de Cloudinary)
create table gallery (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  public_id text not null,
  categoria text not null, -- 'bodas' | 'corporativo' | 'privados' | 'platos'
  alt_text text,
  orden int default 0,
  created_at timestamptz default now()
);

-- Solicitudes de contacto
create table quotes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null,
  telefono text,
  tipo_evento text,
  fecha_evento date,
  comensales int,
  zona text,
  mensaje text,
  estado text default 'pendiente',
  created_at timestamptz default now()
);

-- Testimonios
create table testimonios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  texto text not null,
  evento text,
  aprobado boolean default false,
  destacado boolean default false,
  created_at timestamptz default now()
);

-- =============================================
-- Row Level Security (RLS)
-- =============================================

alter table content enable row level security;
alter table gallery enable row level security;
alter table quotes enable row level security;
alter table testimonios enable row level security;

-- Content: lectura pública, escritura solo admin
create policy "content_read" on content for select using (true);
create policy "content_write" on content for all using (auth.role() = 'authenticated');

-- Gallery: lectura pública, escritura solo admin
create policy "gallery_read" on gallery for select using (true);
create policy "gallery_write" on gallery for all using (auth.role() = 'authenticated');

-- Quotes: inserción pública, lectura/escritura admin
create policy "quotes_insert" on quotes for insert with check (true);
create policy "quotes_admin" on quotes for all using (auth.role() = 'authenticated');

-- Testimonios: lectura pública (solo aprobados), escritura admin
create policy "testimonios_read" on testimonios for select using (aprobado = true);
create policy "testimonios_admin" on testimonios for all using (auth.role() = 'authenticated');
