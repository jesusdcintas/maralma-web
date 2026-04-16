/**
 * MarAlma CMS — Inline editor script
 *
 * Adds inline editing capabilities to any page when admin is authenticated.
 * Works with `data-cms="key"` attributes for text and `data-cms-img="key"` for images.
 *
 * Loaded in Layout.astro as a module script.
 */

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const CLOUDINARY_CLOUD = import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME || "dshe7obcn";
const CLOUDINARY_PRESET = import.meta.env.PUBLIC_CLOUDINARY_UPLOAD_PRESET || "maralma_upload";

/* ── Supabase auth check (lightweight, no SDK needed) ── */
async function checkAdmin(): Promise<string | null> {
  // Use supabase-js from the page's existing bundle if available, else use REST
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await sb.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

/* ── Admin bar ── */
function createAdminBar(onLogout: () => void): HTMLElement {
  const bar = document.createElement("div");
  bar.id = "cms-admin-bar";
  bar.innerHTML = `
    <span class="cms-bar-indicator"></span>
    <span class="cms-bar-text">Modo edición activo</span>
    <div class="cms-bar-right">
      <span class="cms-bar-status" id="cmsStatus"></span>
      <button class="cms-bar-btn" id="cmsLogout">Salir</button>
    </div>
  `;
  document.body.prepend(bar);
  document.body.style.paddingTop = "36px";

  // Adjust fixed nav
  const nav = document.getElementById("navbar");
  if (nav) nav.style.top = "36px";

  document.getElementById("cmsLogout")?.addEventListener("click", onLogout);
  return bar;
}

/* ── Status indicator ── */
function setStatus(msg: string, type: "saving" | "saved" | "error" = "saved") {
  const el = document.getElementById("cmsStatus");
  if (!el) return;
  el.textContent = msg;
  el.className = `cms-bar-status cms-status-${type}`;
  if (type === "saved") {
    setTimeout(() => { el.textContent = ""; }, 2000);
  }
}

/* ── Save content via API ── */
async function saveContent(key: string, value: string, publicId?: string) {
  setStatus("Guardando…", "saving");
  try {
    const body: Record<string, string> = { key, value };
    if (publicId) body.publicId = publicId;

    const res = await fetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Save failed");
    setStatus("Guardado ✓", "saved");
  } catch {
    setStatus("Error al guardar", "error");
  }
}

/* ── Fetch all content overrides ── */
async function fetchOverrides(): Promise<Record<string, { value: string; type: string; publicId?: string }>> {
  try {
    const res = await fetch("/api/admin/content");
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/* ── Make text elements editable ── */
function enableTextEditing(el: HTMLElement, key: string) {
  // Visual hint on hover
  el.classList.add("cms-editable");

  el.addEventListener("click", (e) => {
    if (el.isContentEditable) return;
    e.preventDefault();
    e.stopPropagation();

    el.contentEditable = "true";
    el.classList.add("cms-editing");
    el.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  });

  el.addEventListener("blur", () => {
    el.contentEditable = "false";
    el.classList.remove("cms-editing");
    const newValue = el.innerText.trim();
    if (newValue) {
      saveContent(key, newValue);
    }
  });

  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      el.blur();
    }
    if (e.key === "Escape") {
      el.blur();
    }
  });
}

/* ── Compress image utility ── */
function compressImage(file: File, maxW = 2400, maxH = 2400, quality = 0.85): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width: w, height: h } = img;
      if (w > maxW || h > maxH) {
        const r = Math.min(maxW / w, maxH / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          resolve(new File([blob!], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality,
      );
    };
    img.src = url;
  });
}

/* ── Upload to Cloudinary ── */
async function uploadToCloudinary(file: File, folder = "maralma/cms"): Promise<{ url: string; publicId: string }> {
  const compressed = await compressImage(file);
  const fd = new FormData();
  fd.append("file", compressed);
  fd.append("upload_preset", CLOUDINARY_PRESET);
  fd.append("folder", folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: "POST",
    body: fd,
  });
  const data = await res.json();
  return { url: data.secure_url, publicId: data.public_id };
}

/* ── Make image elements editable ── */
function enableImageEditing(el: HTMLElement, key: string) {
  const wrapper = document.createElement("div");
  wrapper.className = "cms-img-wrapper";
  wrapper.style.position = "relative";
  wrapper.style.display = el.tagName === "IMG" ? "inline-block" : "block";

  // For elements with background-image, wrap the element
  el.parentNode?.insertBefore(wrapper, el);
  wrapper.appendChild(el);

  // Create overlay
  const overlay = document.createElement("div");
  overlay.className = "cms-img-overlay";
  overlay.innerHTML = `
    <label class="cms-img-btn">
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
      Cambiar foto
      <input type="file" accept="image/*" style="display:none" />
    </label>
    <div class="cms-img-progress" style="display:none">
      <div class="cms-img-progress-bar"></div>
    </div>
  `;
  wrapper.appendChild(overlay);

  const input = overlay.querySelector("input") as HTMLInputElement;
  input.addEventListener("change", async () => {
    if (!input.files?.length) return;
    const file = input.files[0];
    const progressWrap = overlay.querySelector(".cms-img-progress") as HTMLElement;
    const progressBar = overlay.querySelector(".cms-img-progress-bar") as HTMLElement;

    progressWrap.style.display = "block";
    progressBar.style.width = "30%";
    setStatus("Subiendo imagen…", "saving");

    try {
      progressBar.style.width = "60%";
      const { url, publicId } = await uploadToCloudinary(file);
      progressBar.style.width = "90%";

      // Update the element
      if (el.tagName === "IMG") {
        (el as HTMLImageElement).src = url;
      } else {
        el.style.backgroundImage = `url(${url})`;
        el.style.backgroundSize = "cover";
        el.style.backgroundPosition = "center";
      }

      await saveContent(key, url, publicId);
      progressBar.style.width = "100%";
      setTimeout(() => {
        progressWrap.style.display = "none";
        progressBar.style.width = "0";
      }, 500);
    } catch {
      setStatus("Error al subir imagen", "error");
      progressWrap.style.display = "none";
    }
    input.value = "";
  });
}

/* ── Apply overrides to DOM ── */
function applyOverrides(overrides: Record<string, { value: string; type: string; publicId?: string }>) {
  // Text overrides
  document.querySelectorAll<HTMLElement>("[data-cms]").forEach((el) => {
    const key = el.getAttribute("data-cms")!;
    const override = overrides[key];
    if (override && override.type === "text") {
      el.innerText = override.value;
    }
  });

  // Image overrides
  document.querySelectorAll<HTMLElement>("[data-cms-img]").forEach((el) => {
    const key = el.getAttribute("data-cms-img")!;
    const override = overrides[key];
    if (override && override.type === "image") {
      if (el.tagName === "IMG") {
        (el as HTMLImageElement).src = override.value;
      } else {
        el.style.backgroundImage = `url(${override.value})`;
        el.style.backgroundSize = "cover";
        el.style.backgroundPosition = "center";
      }
    }
  });
}

/* ── Inject CMS styles ── */
function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    #cms-admin-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      height: 36px; background: #1e3a4f;
      display: flex; align-items: center; padding: 0 20px;
      font-family: 'Jost', sans-serif; font-size: 11px;
      color: rgba(255,255,255,0.85); letter-spacing: 0.08em;
    }
    .cms-bar-indicator {
      width: 6px; height: 6px; border-radius: 50%;
      background: #25d366; margin-right: 10px;
      animation: cmsPulse 2s ease-in-out infinite;
    }
    @keyframes cmsPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .cms-bar-right {
      margin-left: auto; display: flex; align-items: center; gap: 14px;
    }
    .cms-bar-status {
      font-size: 10px; letter-spacing: 0.1em; transition: opacity 0.3s;
    }
    .cms-status-saving { color: #a8c4c8; }
    .cms-status-saved { color: #25d366; }
    .cms-status-error { color: #ff6b6b; }
    .cms-bar-btn {
      background: rgba(255,255,255,0.12); border: 0.5px solid rgba(255,255,255,0.25);
      color: rgba(255,255,255,0.8); padding: 4px 14px;
      font-family: 'Jost', sans-serif; font-size: 10px;
      letter-spacing: 0.14em; text-transform: uppercase;
      cursor: pointer; transition: all 0.2s;
    }
    .cms-bar-btn:hover { background: rgba(255,255,255,0.25); color: #fff; }

    /* ── Editable text ── */
    .cms-editable {
      cursor: pointer;
      transition: outline 0.2s, outline-offset 0.2s;
      outline: 2px solid transparent;
      outline-offset: 4px;
    }
    .cms-editable:hover {
      outline-color: rgba(30, 58, 79, 0.35);
    }
    .cms-editable.cms-editing {
      outline-color: #1e3a4f;
      outline-style: solid;
      background: rgba(30, 58, 79, 0.04);
    }

    /* ── Editable images ── */
    .cms-img-wrapper { position: relative; }
    .cms-img-overlay {
      position: absolute; inset: 0; z-index: 10;
      display: flex; align-items: center; justify-content: center;
      background: rgba(15, 26, 32, 0.5);
      opacity: 0; transition: opacity 0.3s; cursor: pointer;
    }
    .cms-img-wrapper:hover .cms-img-overlay { opacity: 1; }
    .cms-img-btn {
      display: flex; align-items: center; gap: 8px;
      background: rgba(255,255,255,0.95); color: #1e3a4f;
      padding: 10px 18px; font-family: 'Jost', sans-serif;
      font-size: 11px; font-weight: 500; letter-spacing: 0.12em;
      text-transform: uppercase; cursor: pointer; transition: all 0.2s;
      border: none;
    }
    .cms-img-btn:hover { background: #fff; }
    .cms-img-btn svg { width: 16px; height: 16px; }
    .cms-img-progress {
      position: absolute; bottom: 0; left: 0; right: 0; height: 3px;
      background: rgba(255,255,255,0.2);
    }
    .cms-img-progress-bar {
      height: 100%; background: #a8c4c8;
      transition: width 0.3s ease; width: 0;
    }
  `;
  document.head.appendChild(style);
}

/* ── INIT ── */
async function initCMS() {
  // Don't run on admin pages
  if (window.location.pathname.startsWith("/admin")) return;

  const token = await checkAdmin();
  if (!token) return; // Not logged in, do nothing

  injectStyles();

  // Fetch content overrides and apply to DOM
  const overrides = await fetchOverrides();
  applyOverrides(overrides);

  // Create admin bar
  createAdminBar(async () => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      await sb.auth.signOut();
    } catch { /* ignore */ }
    window.location.reload();
  });

  // Enable text editing
  document.querySelectorAll<HTMLElement>("[data-cms]").forEach((el) => {
    enableTextEditing(el, el.getAttribute("data-cms")!);
  });

  // Enable image editing
  document.querySelectorAll<HTMLElement>("[data-cms-img]").forEach((el) => {
    enableImageEditing(el, el.getAttribute("data-cms-img")!);
  });
}

// Run when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCMS);
} else {
  initCMS();
}
