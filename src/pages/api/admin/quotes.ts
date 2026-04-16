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

/** GET /api/admin/quotes?count_only=true&estado=pendiente */
export const GET: APIRoute = async ({ request, url }) => {
  if (!(await checkAuth(request))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const countOnly = url.searchParams.get("count_only") === "true";
  const estado = url.searchParams.get("estado");

  try {
    if (countOnly) {
      const { count: total } = await supabaseAdmin
        .from("quotes")
        .select("*", { count: "exact", head: true });
      const { count: pendientes } = await supabaseAdmin
        .from("quotes")
        .select("*", { count: "exact", head: true })
        .eq("estado", "pendiente");
      return new Response(JSON.stringify({ total: total || 0, pendientes: pendientes || 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let query = supabaseAdmin
      .from("quotes")
      .select("*")
      .order("created_at", { ascending: false });

    if (estado) {
      query = query.eq("estado", estado);
    }

    const { data, error } = await query;
    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Error al obtener solicitudes" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

/** PATCH /api/admin/quotes  body: { id, estado } */
export const PATCH: APIRoute = async ({ request }) => {
  if (!(await checkAuth(request))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { id, estado } = await request.json();
    if (!id || !estado) {
      return new Response(JSON.stringify({ error: "id y estado son obligatorios" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const allowed = ["pendiente", "contactado", "cerrado"];
    if (!allowed.includes(estado)) {
      return new Response(JSON.stringify({ error: "Estado no válido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { error } = await supabaseAdmin
      .from("quotes")
      .update({ estado })
      .eq("id", id);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Error al actualizar solicitud" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
