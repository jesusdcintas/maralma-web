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

/** GET /api/admin/event-images?event_id=xxx — list images for event */
export const GET: APIRoute = async ({ url }) => {
  const eventId = url.searchParams.get("event_id");
  if (!eventId) {
    return new Response(JSON.stringify({ error: "event_id requerido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabaseAdmin
    .from("event_images")
    .select("*")
    .eq("event_id", eventId)
    .order("orden", { ascending: true });

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

/** POST /api/admin/event-images — add image(s) to event */
export const POST: APIRoute = async ({ request }) => {
  if (!(await checkAuth(request))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();

    // Support batch: { images: [...] } or single: { event_id, url, public_id, ... }
    const images = body.images || [body];

    const rows = images.map((img: any, i: number) => ({
      event_id: img.event_id,
      url: img.url,
      public_id: img.public_id,
      alt_text: img.alt_text || null,
      orden: img.orden ?? i,
    }));

    const { data, error } = await supabaseAdmin
      .from("event_images")
      .insert(rows)
      .select();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Error al añadir imagen" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

/** DELETE /api/admin/event-images — remove image from event */
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

    const { error } = await supabaseAdmin
      .from("event_images")
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
    return new Response(JSON.stringify({ error: "Error al eliminar imagen" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

/** PATCH /api/admin/event-images — reorder images */
export const PATCH: APIRoute = async ({ request }) => {
  if (!(await checkAuth(request))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { images } = await request.json();
    // images = [ { id, orden }, { id, orden }, ... ]

    if (!Array.isArray(images)) {
      return new Response(JSON.stringify({ error: "Array de imágenes requerido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    for (const img of images) {
      await supabaseAdmin
        .from("event_images")
        .update({ orden: img.orden })
        .eq("id", img.id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Error al reordenar" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
