import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { createClient } from "@supabase/supabase-js";

async function checkAuth(request: Request): Promise<boolean> {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return false;
  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return !error && !!user;
}

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** GET /api/admin/events — list events (admin: all, public: published only) */
export const GET: APIRoute = async ({ request, url }) => {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  const isAdmin = !!token;

  const slugParam = url.searchParams.get("slug");

  if (slugParam) {
    // Single event by slug
    let query = supabaseAdmin
      .from("events")
      .select("*")
      .eq("slug", slugParam)
      .single();

    const { data, error } = await query;

    if (error || !data) {
      return new Response(JSON.stringify({ error: "Evento no encontrado" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Non-admin can only see published events
    if (!isAdmin && !data.publicado) {
      return new Response(JSON.stringify({ error: "Evento no encontrado" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // List all events
  let query = supabaseAdmin
    .from("events")
    .select("*")
    .order("orden", { ascending: true })
    .order("fecha", { ascending: false });

  if (!isAdmin) {
    query = query.eq("publicado", true);
  }

  const { data, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
};

/** POST /api/admin/events — create or update event */
export const POST: APIRoute = async ({ request }) => {
  if (!(await checkAuth(request))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { id, titulo, subtitulo, tipo, fecha, ubicacion, descripcion, cover_url, cover_public_id, publicado, orden } = body;

    if (!titulo || !tipo) {
      return new Response(JSON.stringify({ error: "Título y tipo son requeridos" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const slug = slugify(titulo);

    const eventData: Record<string, unknown> = {
      titulo,
      subtitulo: subtitulo || null,
      tipo,
      fecha: fecha || null,
      ubicacion: ubicacion || null,
      descripcion: descripcion || null,
      cover_url: cover_url || null,
      cover_public_id: cover_public_id || null,
      slug,
      publicado: publicado ?? false,
      orden: orden ?? 0,
    };

    let data;
    let error;

    if (id) {
      // Update
      const result = await supabaseAdmin
        .from("events")
        .update(eventData)
        .eq("id", id)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else {
      // Insert
      const result = await supabaseAdmin
        .from("events")
        .insert(eventData)
        .select()
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: id ? 200 : 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Error al guardar evento" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

/** DELETE /api/admin/events — delete event */
export const DELETE: APIRoute = async ({ request }) => {
  if (!(await checkAuth(request))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { id } = await request.json();
    if (!id) {
      return new Response(JSON.stringify({ error: "ID requerido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // event_images cascade-deleted automatically
    const { error } = await supabaseAdmin
      .from("events")
      .delete()
      .eq("id", id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Error al eliminar evento" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
