# Maralma — Estado del proyecto

## Implementado

### Paginas publicas (estilo v2)

- **index.astro** — 12 secciones: hero video+mute, claim con watermark, servicios estilo Proboca, 3 frases separadoras, bodas split dark, por-que cards, reviews slider (5 reviews, flechas, dots, JS), equipo, galeria 4 columnas con filtros, CTA final
- **bodas.astro** — Hero dark con gradient+wave+scroll, cocktail/banquet detail splits con borde accent, frase dark, 3 pq-cards con hover, CTA final
- **eventos.astro** — Hero dark, corporate/private detail splits, frase dark, CTA final
- **nosotros.astro** — Page hero, about split, team cards con iniciales
- **galeria.astro** — Section header, filtros por categoria, grid con variantes tall/wide
- **contacto.astro** — Hero dark gradient/wave/fadeUp, sidebar (info+redes+cita), formulario 3 secciones, success state, error inline

### Layout global

- Navbar responsive con lang-switcher (ES/EN), estado dark/light segun pagina, scroll handler
- FAB expandible (+) con 3 acciones: WhatsApp, llamada, Instagram
- i18n con astro-i18next, traducciones ES/EN completas en todos los textos

### Panel admin

- `/admin` — Login con Supabase Auth, panel de control con enlaces
- `/admin/galeria` — Gestion completa de imagenes:
  - Auth gate (redirige si no hay sesion)
  - 9 categorias: Todas, Bodas, Corporativo, Privados, Platos, Hero, Equipo, Recursos
  - Upload drag & drop con compresion automatica (max 2400px, JPEG, <8MB)
  - Sin limite de tamaño de entrada
  - Barra de progreso: Comprimiendo → Subiendo → Completada
  - Grid de thumbnails con transforms Cloudinary
  - Eliminacion individual (boton sobre cada foto)
  - Eliminacion masiva: modo seleccion, seleccionar todas, barra flotante, confirmacion
  - Modales custom estilo Maralma (sin alert/confirm nativos)

### APIs

| Endpoint | Metodo | Funcion |
|----------|--------|---------|
| `/api/contact` | POST | Guarda solicitud de presupuesto en Supabase (tabla `quotes`) |
| `/api/admin/images` | GET | Lista imagenes de Cloudinary por carpeta (requiere auth) |
| `/api/admin/images` | DELETE | Elimina imagen de Cloudinary (requiere auth) |
| `/api/gallery/save` | POST | Guarda metadata en Supabase tabla `gallery` (requiere auth) |
| `/api/gallery/delete` | DELETE | Elimina de Cloudinary (firma SHA-1 server-side) + Supabase (requiere auth) |

### Utilidades

- `src/utils/compressImage.ts` — Compresion client-side: redimensiona a max 2400x2400, JPEG con calidad adaptativa (0.85→0.60) hasta quedar bajo 8MB
- `src/lib/cloudinary.ts` — Instancia Cloudinary configurada
- `src/lib/supabase.ts` — Cliente Supabase (anon key)
- `src/lib/supabase-admin.ts` — Cliente Supabase (service role key)

### Infraestructura

- Astro 5 con TypeScript strict
- Tailwind CSS v4
- Supabase: auth + tablas `quotes`, `gallery`
- Cloudinary: SDK v2, upload preset `maralma_upload`
- Vercel adapter configurado

---

## Pendiente

### Configurar video del hero
- Subir video a Cloudinary o directamente a `/public/video/`
- Conectar el `<video>` del hero en index.astro con la URL real
- Verificar autoplay, mute, loop funcionan correctamente

### Datos de contacto reales
- Reemplazar telefono placeholder (+34 600 000 000) en contacto.astro y Layout.astro (FAB)
- Reemplazar enlace WhatsApp (wa.me/34600000000)
- Reemplazar Instagram (@maralma.catering)
- Reemplazar email si es diferente a hola@maralma.catering

### Deploy a Vercel
- Configurar proyecto en Vercel
- Conectar repositorio Git
- Configurar variables de entorno en Vercel dashboard
- Verificar build y funcionamiento en produccion
- Configurar dominio personalizado si lo hay
