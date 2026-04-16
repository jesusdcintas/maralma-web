import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { createClient } from "@supabase/supabase-js";
import cloudinary from "../../../lib/cloudinary";

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

/** GET /api/admin/folders — list all folders */
export const GET: APIRoute = async () => {
  const { data, error } = await supabaseAdmin
    .from("folders")
    .select("*")
    .order("name", { ascending: true });

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

/** POST /api/admin/folders — create folder */
export const POST: APIRoute = async ({ request }) => {
  if (!(await checkAuth(request))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { name } = await request.json();
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Nombre requerido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const slug = name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const cloudinaryPath = "maralma/" + slug;

    // Create Cloudinary folder
    try {
      await cloudinary.api.create_folder(cloudinaryPath);
    } catch {
      // Folder may already exist — ignore
    }

    const { data, error } = await supabaseAdmin
      .from("folders")
      .insert({ name: name.trim(), slug, cloudinary_path: cloudinaryPath })
      .select()
      .single();

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
    return new Response(JSON.stringify({ error: "Error al crear carpeta" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

/** DELETE /api/admin/folders — delete folder (only if empty) */
export const DELETE: APIRoute = async ({ request }) => {
  if (!(await checkAuth(request))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { id, cloudinary_path } = await request.json();
    if (!id) {
      return new Response(JSON.stringify({ error: "ID requerido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if folder has images in Cloudinary
    if (cloudinary_path) {
      try {
        const result = await cloudinary.api.resources({
          type: "upload",
          prefix: cloudinary_path,
          max_results: 1,
          resource_type: "image",
        });
        if (result.resources && result.resources.length > 0) {
          return new Response(
            JSON.stringify({ error: "La carpeta tiene imágenes. Elimínalas primero." }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
      } catch {
        // If we can't check, allow deletion
      }
    }

    const { error } = await supabaseAdmin
      .from("folders")
      .delete()
      .eq("id", id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Try to delete Cloudinary folder
    if (cloudinary_path) {
      try {
        await cloudinary.api.delete_folder(cloudinary_path);
      } catch {
        // Ignore — folder might not exist
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Error al eliminar carpeta" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
