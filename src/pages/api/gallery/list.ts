import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabase-admin";

/** GET /api/gallery/list?limit=6  — public, returns gallery images ordered by `orden` */
export const GET: APIRoute = async ({ url }) => {
  const limit = Math.min(Number(url.searchParams.get("limit")) || 6, 50);

  const { data, error } = await supabaseAdmin
    .from("gallery")
    .select("url, public_id, categoria, alt_text")
    .order("orden", { ascending: true })
    .limit(limit);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data ?? []), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
