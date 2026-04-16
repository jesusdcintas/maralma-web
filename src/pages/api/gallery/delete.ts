import type { APIRoute } from "astro";
import crypto from "crypto";
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

/** DELETE /api/gallery/delete  body: { id?: string, public_id: string } */
export const DELETE: APIRoute = async ({ request }) => {
  if (!(await checkAuth(request))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { id, public_id } = body as { id?: string; public_id: string };

    if (!public_id || typeof public_id !== "string") {
      return new Response(JSON.stringify({ error: "public_id requerido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1. Delete from Cloudinary using signed request
    const apiKey = import.meta.env.CLOUDINARY_API_KEY;
    const apiSecret = import.meta.env.CLOUDINARY_API_SECRET;
    const cloudName = import.meta.env.CLOUDINARY_CLOUD_NAME;
    const timestamp = Math.round(Date.now() / 1000);

    const signature = crypto
      .createHash("sha1")
      .update("public_id=" + public_id + "&timestamp=" + timestamp + apiSecret)
      .digest("hex");

    const cloudRes = await fetch(
      "https://api.cloudinary.com/v1_1/" + cloudName + "/image/destroy",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_id,
          timestamp,
          api_key: apiKey,
          signature,
        }),
      },
    );

    const cloudResult = await cloudRes.json();
    if (cloudResult.result !== "ok" && cloudResult.result !== "not found") {
      return new Response(
        JSON.stringify({ error: "Error al eliminar de Cloudinary", detail: cloudResult }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. Delete from Supabase gallery table (if id provided)
    if (id) {
      const { error } = await supabaseAdmin
        .from("gallery")
        .delete()
        .eq("id", id);

      if (error) {
        // Image already deleted from Cloudinary, log but don't fail
        console.error("Supabase delete error:", error);
      }
    } else {
      // Try to delete by public_id
      const { error } = await supabaseAdmin
        .from("gallery")
        .delete()
        .eq("public_id", public_id);

      if (error) {
        console.error("Supabase delete error:", error);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Error del servidor" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
