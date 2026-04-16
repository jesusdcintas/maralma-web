import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../lib/supabase-admin";
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

// GET — read hero video from gallery table (categoria = 'hero_video')
export const GET: APIRoute = async ({ url }) => {
  const key = url.searchParams.get("key");
  if (key !== "hero_video_url") {
    return new Response(JSON.stringify({ value: null }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data } = await supabaseAdmin
    .from("gallery")
    .select("url")
    .eq("categoria", "hero_video")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return new Response(JSON.stringify({ value: data?.url ?? null }), {
    headers: { "Content-Type": "application/json" },
  });
};

// POST — save hero video URL to gallery table (auth required)
export const POST: APIRoute = async ({ request }) => {
  if (!(await checkAuth(request))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { key, value, public_id } = body;
  if (key !== "hero_video_url" || !value) {
    return new Response("Invalid request", { status: 400 });
  }

  // Delete old hero_video entries
  await supabaseAdmin
    .from("gallery")
    .delete()
    .eq("categoria", "hero_video");

  // Insert new one
  const { error } = await supabaseAdmin
    .from("gallery")
    .insert({
      url: value,
      public_id: public_id || "hero_video",
      categoria: "hero_video",
    });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
