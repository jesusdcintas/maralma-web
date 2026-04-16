import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";

export const onRequest = defineMiddleware(async ({ cookies, redirect, url }, next) => {
  const path = url.pathname;

  // Only protect /admin/* pages (not the login page itself, not API routes)
  if (!path.startsWith("/admin")) return next();
  if (path === "/admin" || path === "/admin/") return next();
  if (path.startsWith("/api/")) return next();

  const token = cookies.get("sb-access-token")?.value;
  if (!token) return redirect("/admin", 302);

  try {
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      cookies.delete("sb-access-token", { path: "/" });
      return redirect("/admin", 302);
    }
  } catch {
    cookies.delete("sb-access-token", { path: "/" });
    return redirect("/admin", 302);
  }

  return next();
});
