# Maralma — Estado del proyecto

---

## ✅ COMPLETADO

- Web desplegada en Vercel — `maralma-web.vercel.app`
- Hero con vídeo real subido a Cloudinary
- Páginas: Home, Nosotros, Bodas, Eventos, Galería, Contacto
- Panel admin en `/admin` con sidebar completo
- CMS inline — edición de textos e imágenes directamente sobre la web
- Sliders de posición de imagen (↕ ↔)
- Galería de eventos con filtros por tipo
- Sistema de carpetas dinámicas en Cloudinary
- MediaPicker funcional con thumbnails cuadradas
- Formulario de contacto → guarda en Supabase tabla `quotes`
- i18n ES/EN con nanostores
- Layout móvil de `/nosotros` (foto arriba, texto abajo)
- Estructura de `/nosotros` fiel al dossier PDF
- Contraste y tipografía del footer y tarjetas de evento

---

## 🔴 URGENTE — Sin esto la web no está lista para lanzar

- [x] **Teléfono y WhatsApp reales** — actualizado a `+34 658 403 496` en todos los sitios (Layout FAB, index, bodas, eventos, contacto).
- [ ] **Fotos reales** — subir desde el modo admin:
  - Foto de Juan (chef cocinando)
  - Foto de Miriam (retrato)
  - Fotos de cards de servicios (Bodas, Corporativo, Privado)
  - Fotos de la sección split de Bodas
- [ ] **Política de privacidad y Aviso legal** — crear las páginas `/privacidad` y `/legal` y enlazarlas desde el footer. Obligatorio por RGPD.
- [ ] **Cookie banner** — implementar aviso de cookies. Obligatorio en España.

---

## 🟡 PENDIENTE — Funcionalidades aplazadas

- [ ] **Reseñas reales**
  - Las 5 reseñas actuales son ficticias
  - Opciones: A) Añadir manualmente desde Supabase tabla `testimonios` con `aprobado = true`, B) Cuando esté el panel de testimonios en `/admin`, añadirlas desde ahí
  - Reseñas disponibles: Germán & Carmen (boda cóctel Cádiz), más las que tengan en Google o WhatsApp
- [ ] **Feed de Instagram**
  - Requiere credenciales de Meta de Juan o Miriam
  - Arquitectura ya definida: `GET /api/instagram` + cron job mensual en `vercel.json`
  - Pasos pendientes: crear app en developers.facebook.com → obtener token → añadir `INSTAGRAM_ACCESS_TOKEN` y `INSTAGRAM_USER_ID` a Vercel
  - Se mostrará en `/galeria` como grid de 4 columnas con fotos cuadradas

---

## 🟢 MEJORAS OPCIONALES

- [ ] **SEO** — meta description, og:image, keywords en todas las páginas
- [ ] **Google Reviews** — vincular reseñas de Google (requiere Google Business verificado)
- [ ] **Galería home** — cargar fotos dinámicamente desde Supabase en runtime
- [ ] **Página `/galeria/[slug]`** — lightbox para ver fotos de cada evento
- [ ] **Vista móvil** — revisar resto de páginas (Bodas, Eventos, Contacto) en móvil
- [ ] **Warning GoTrueClient** — múltiples instancias de Supabase en `cms-inline.ts` (no crítico)
