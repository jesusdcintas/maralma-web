import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../lib/supabase-admin";

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

/** GET /api/admin/testimonios?count_only=true */
export const GET: APIRoute = async ({ request, url }) => {
  if (!(await checkAuth(request))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const countOnly = url.searchParams.get("count_only") === "true";

  try {
    if (countOnly) {
      const { count: total } = await supabaseAdmin
        .from("testimonios")
        .select("*", { count: "exact", head: true });
      const { count: pendientes } = await supabaseAdmin
        .from("testimonios")
        .select("*", { count: "exact", head: true })
        .eq("aprobado", false);
      return new Response(JSON.stringify({ total: total || 0, pendientes: pendientes || 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabaseAdmin
      .from("testimonios")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Error al obtener testimonios" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

/** POST /api/admin/testimonios  body: { nombre, texto, evento } */
export const POST: APIRoute = async ({ request }) => {
  if (!(await checkAuth(request))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { nombre, texto, evento } = await request.json();
    if (!nombre || !texto) {
      return new Response(JSON.stringify({ error: "Nombre y texto son obligatorios" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabaseAdmin
      .from("testimonios")
      .insert({ nombre, texto, evento: evento || null, aprobado: true })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Error al crear testimonio" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

/** PATCH /api/admin/testimonios  body: { id, aprobado?, destacado? } */
export const PATCH: APIRoute = async ({ request }) => {
  if (!(await checkAuth(request))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { id, ...fields } = body;
    if (!id) {
      return new Response(JSON.stringify({ error: "id es obligatorio" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const allowed: Record<string, boolean> = { aprobado: true, destacado: true, nombre: true, texto: true, evento: true };
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (allowed[k]) updates[k] = v;
    }

    if (!Object.keys(updates).length) {
      return new Response(JSON.stringify({ error: "Sin campos válidos para actualizar" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { error } = await supabaseAdmin
      .from("testimonios")
      .update(updates)
      .eq("id", id);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Error al actualizar testimonio" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

/** DELETE /api/admin/testimonios  body: { id } */
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
      return new Response(JSON.stringify({ error: "id es obligatorio" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { error } = await supabaseAdmin
      .from("testimonios")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Error al eliminar testimonio" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
