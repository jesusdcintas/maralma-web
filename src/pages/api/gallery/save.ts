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

/** POST /api/gallery/save  body: { public_id, url, categoria?, alt_text? } */
export const POST: APIRoute = async ({ request }) => {
  if (!(await checkAuth(request))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { public_id, url, categoria, alt_text } = body;

    if (!public_id || !url) {
      return new Response(JSON.stringify({ error: "public_id y url requeridos" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabaseAdmin
      .from("gallery")
      .insert({
        public_id,
        url,
        categoria: categoria || "general",
        alt_text: alt_text || null,
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: "Error al guardar en base de datos", detail: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Error del servidor" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
