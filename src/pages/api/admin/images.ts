import type { APIRoute } from "astro";
import cloudinary from "../../../lib/cloudinary";
import { createClient } from "@supabase/supabase-js";

async function checkAuth(request: Request): Promise<boolean> {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return false;

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  );
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  return !error && !!user;
}

/** GET /api/admin/images?folder=maralma/bodas */
export const GET: APIRoute = async ({ request, url }) => {
  if (!(await checkAuth(request))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const folder = url.searchParams.get("folder") || "maralma";

  try {
    const result = await cloudinary.api.resources({
      type: "upload",
      prefix: folder,
      max_results: 200,
      resource_type: "image",
    });
    return new Response(JSON.stringify(result.resources), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Error al obtener imágenes" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

/** DELETE /api/admin/images  body: { public_id: "maralma/bodas/xxx" } */
export const DELETE: APIRoute = async ({ request }) => {
  if (!(await checkAuth(request))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { public_id } = await request.json();
    if (!public_id || typeof public_id !== "string") {
      return new Response(JSON.stringify({ error: "public_id requerido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = await cloudinary.uploader.destroy(public_id);
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Error al eliminar" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
