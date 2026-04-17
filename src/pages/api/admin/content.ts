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

/**
 * Content CMS API — uses `gallery` table with categoria='cms' / 'cms_img'
 *
 * GET  /api/admin/content?keys=hero.tagline,claim.text_1
 *   → { "hero.tagline": "...", "claim.text_1": "..." }
 *
 * GET  /api/admin/content              (no keys param)
 *   → returns ALL cms entries
 *
 * POST /api/admin/content
 *   body: { key: "hero.tagline", value: "new text" }
 *   → upserts text content
 *
 * POST /api/admin/content
 *   body: { key: "team.juan.photo", value: "https://cloudinary...", publicId: "maralma/..." }
 *   → upserts image content
 *
 * DELETE /api/admin/content
 *   body: { key: "hero.tagline" }
 *   → deletes content override (reverts to default)
 */

export const GET: APIRoute = async ({ request, url }) => {
  const keysParam = url.searchParams.get("keys");

  // GET is public (overrides applied to all visitors)
  let query = supabaseAdmin
    .from("gallery")
    .select("alt_text, url, public_id, categoria")
    .in("categoria", ["cms", "cms_img"]);

  if (keysParam) {
    const keys = keysParam.split(",").map((k) => k.trim());
    query = query.in("alt_text", keys);
  }

  const { data, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const result: Record<string, { value: string; type: string; publicId?: string }> = {};
  for (const row of data || []) {
    result[row.alt_text] = {
      value: row.url,
      type: row.categoria === "cms_img" ? "image" : "text",
      ...(row.public_id ? { publicId: row.public_id } : {}),
    };
  }

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  if (!(await checkAuth(request))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json();
  const { key, value, publicId } = body;

  if (!key || !value) {
    return new Response(JSON.stringify({ error: "key and value required" }), { status: 400 });
  }

  const categoria = publicId ? "cms_img" : "cms";

  // Delete existing entry for this key
  await supabaseAdmin
    .from("gallery")
    .delete()
    .eq("alt_text", key)
    .in("categoria", ["cms", "cms_img"]);

  // Insert new
  const { error } = await supabaseAdmin.from("gallery").insert({
    url: value,
    public_id: publicId || `cms_${key}`,
    categoria,
    alt_text: key,
    orden: 0,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }));
};

export const DELETE: APIRoute = async ({ request }) => {
  if (!(await checkAuth(request))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json();
  const { key } = body;

  if (!key) {
    return new Response(JSON.stringify({ error: "key required" }), { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("gallery")
    .delete()
    .eq("alt_text", key)
    .in("categoria", ["cms", "cms_img"]);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }));
};
