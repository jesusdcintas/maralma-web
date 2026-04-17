import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";

export const onRequest = defineMiddleware(async ({ cookies, redirect, url }, next) => {
  const path = url.pathname;

  // Only act on /admin/* routes (not API routes)
  const isAdmin = path.startsWith("/admin") || path.startsWith("/en/admin");
  if (!isAdmin) return next();
  if (path.startsWith("/api/")) return next();

  const isLoginPage = path === "/admin" || path === "/admin/" || path === "/en/admin" || path === "/en/admin/";
  const token = cookies.get("sb-access-token")?.value;

  // Login page: if user has a valid token, send them straight to panel
  if (isLoginPage) {
    if (token) {
      try {
        const supabase = createClient(
          import.meta.env.PUBLIC_SUPABASE_URL,
          import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
        );
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (user && !error) return redirect("/admin/panel", 302);
      } catch { /* token invalid — fall through */ }
      // Token present but invalid — clear it to avoid redirect loops
      cookies.delete("sb-access-token", { path: "/" });
    }
    return next();
  }

  // Protected admin pages: require valid token
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
