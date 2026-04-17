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

let authToken: string | null = null;

/* ── Supabase auth check ── */
async function checkAdmin(): Promise<string | null> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await sb.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

/* ── Authenticated fetch helper ── */
function apiFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string> || {}),
  };
  if (authToken) headers["Authorization"] = "Bearer " + authToken;
  if (opts.body && typeof opts.body === "string") {
    headers["Content-Type"] = "application/json";
  }
  return fetch(url, { ...opts, headers });
}

/* ── Admin bar ── */
function createAdminBar(onLogout: () => void): HTMLElement {
  const bar = document.createElement("div");
  bar.id = "cms-admin-bar";
  bar.innerHTML =
    '<span class="cms-bar-indicator"></span>' +
    '<span class="cms-bar-text">Modo edici\u00f3n activo</span>' +
    '<div class="cms-bar-right">' +
      '<span class="cms-bar-status" id="cmsStatus"></span>' +
      '<button class="cms-bar-btn" id="cmsLogout">Salir</button>' +
    '</div>';
  document.body.prepend(bar);
  document.body.style.paddingTop = "36px";
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
  el.className = "cms-bar-status cms-status-" + type;
  if (type === "saved") setTimeout(() => { el.textContent = ""; }, 2000);
}

/* ── Save content via API ── */
async function saveContent(key: string, value: string, publicId?: string) {
  setStatus("Guardando\u2026", "saving");
  try {
    const body: Record<string, string> = { key, value };
    if (publicId) body.publicId = publicId;
    const res = await apiFetch("/api/admin/content", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Save failed");
    }
    setStatus("Guardado \u2713", "saved");
  } catch (e: any) {
    setStatus("Error: " + (e.message || "al guardar"), "error");
  }
}

/* ── Fetch all content overrides ── */
async function fetchOverrides(): Promise<Record<string, { value: string; type: string; publicId?: string }>> {
  try {
    const res = await apiFetch("/api/admin/content");
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/* ── Make text elements editable ── */
function enableTextEditing(el: HTMLElement, key: string) {
  el.classList.add("cms-editable");

  el.addEventListener("click", (e) => {
    if (el.isContentEditable) return;
    e.preventDefault();
    e.stopPropagation();
    el.contentEditable = "true";
    el.classList.add("cms-editing");
    el.focus();
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
    if (newValue) saveContent(key, newValue);
  });

  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); el.blur(); }
    if (e.key === "Escape") el.blur();
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
        (blob) => resolve(new File([blob!], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" })),
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
  const res = await fetch("https://api.cloudinary.com/v1_1/" + CLOUDINARY_CLOUD + "/image/upload", {
    method: "POST",
    body: fd,
  });
  const data = await res.json();
  if (!data.secure_url) throw new Error("Upload failed");
  return { url: data.secure_url, publicId: data.public_id };
}

/* ═══════════════════════════════════════════════════
   MEDIA PICKER — modal to browse/upload Cloudinary images
   ═══════════════════════════════════════════════════ */

interface MediaResult { url: string; publicId: string }
type CloudinaryResource = { secure_url: string; public_id: string; format: string; width: number; height: number };

let dynamicFolders: Array<{ label: string; folder: string }> | null = null;

async function loadMediaFolders(): Promise<Array<{ label: string; folder: string }>> {
  if (dynamicFolders) return dynamicFolders;
  try {
    const res = await fetch("/api/admin/folders");
    if (res.ok) {
      const data: Array<{ name: string; cloudinary_path: string }> = await res.json();
      dynamicFolders = [
        { label: "Todas", folder: "maralma" },
        ...data.map((f) => ({ label: f.name, folder: f.cloudinary_path })),
      ];
    }
  } catch { /* ignore */ }
  if (!dynamicFolders || !dynamicFolders.length) {
    dynamicFolders = [{ label: "Todas", folder: "maralma" }];
  }
  return dynamicFolders;
}

function cloudinaryThumb(url: string, size = 200): string {
  return url.replace("/upload/", "/upload/c_fill,w_" + size + ",h_" + size + ",q_auto,f_auto/");
}

function openMediaPicker(): Promise<MediaResult | null> {
  return new Promise(async (resolve) => {
    let resolved = false;
    function finish(result: MediaResult | null) {
      if (resolved) return;
      resolved = true;
      backdrop.remove();
      resolve(result);
    }

    const mediaFolders = await loadMediaFolders();

    // Backdrop
    const backdrop = document.createElement("div");
    backdrop.className = "cms-media-backdrop";
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) finish(null); });

    // Modal
    const modal = document.createElement("div");
    modal.className = "cms-media-modal";

    // Header
    const header = document.createElement("div");
    header.className = "cms-media-header";
    header.innerHTML =
      '<h3 class="cms-media-title">Seleccionar imagen</h3>' +
      '<button class="cms-media-close">&times;</button>';
    header.querySelector(".cms-media-close")!.addEventListener("click", () => finish(null));

    // Tabs
    const tabs = document.createElement("div");
    tabs.className = "cms-media-tabs";
    mediaFolders.forEach((f, i) => {
      const btn = document.createElement("button");
      btn.className = "cms-media-tab" + (i === 0 ? " active" : "");
      btn.textContent = f.label;
      btn.addEventListener("click", () => {
        tabs.querySelectorAll(".cms-media-tab").forEach((t) => t.classList.remove("active"));
        btn.classList.add("active");
        loadImages(f.folder);
      });
      tabs.appendChild(btn);
    });

    // Upload bar
    const uploadBar = document.createElement("div");
    uploadBar.className = "cms-media-upload-bar";
    uploadBar.innerHTML =
      '<label class="cms-media-upload-btn">' +
        '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">' +
          '<path d="M12 16V4m0 0l-4 4m4-4l4 4"/><path d="M20 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2"/>' +
        '</svg>' +
        ' Subir nueva' +
        '<input type="file" accept="image/*" style="display:none" />' +
      '</label>' +
      '<span class="cms-media-upload-status" id="mediaUploadStatus"></span>';

    const fileInput = uploadBar.querySelector("input") as HTMLInputElement;
    const uploadStatus = uploadBar.querySelector("#mediaUploadStatus") as HTMLElement;

    fileInput.addEventListener("change", async () => {
      if (!fileInput.files?.length) return;
      const file = fileInput.files[0];
      uploadStatus.textContent = "Comprimiendo\u2026";
      try {
        // Detect current folder from active tab
        const activeTab = tabs.querySelector(".cms-media-tab.active");
        const activeIdx = Array.from(tabs.children).indexOf(activeTab!);
        const folder = mediaFolders[activeIdx]?.folder || "maralma/cms";

        uploadStatus.textContent = "Subiendo\u2026";
        const result = await uploadToCloudinary(file, folder);
        uploadStatus.textContent = "Subida \u2713";
        setTimeout(() => { uploadStatus.textContent = ""; }, 2000);
        // Re-load current folder
        loadImages(folder);
        fileInput.value = "";
      } catch {
        uploadStatus.textContent = "Error al subir";
        fileInput.value = "";
      }
    });

    // Grid
    const grid = document.createElement("div");
    grid.className = "cms-media-grid";
    grid.innerHTML = '<p class="cms-media-loading">Cargando im\u00e1genes\u2026</p>';

    async function loadImages(folder: string) {
      grid.innerHTML = '<p class="cms-media-loading">Cargando\u2026</p>';
      try {
        const res = await apiFetch("/api/admin/images?folder=" + encodeURIComponent(folder));
        if (!res.ok) throw new Error("Fetch failed");
        const resources: CloudinaryResource[] = await res.json();
        grid.innerHTML = "";
        if (!resources.length) {
          grid.innerHTML = '<p class="cms-media-empty">No hay im\u00e1genes en esta carpeta</p>';
          return;
        }
        resources.forEach((r) => {
          const item = document.createElement("div");
          item.className = "cms-media-item";
          item.innerHTML =
            '<img src="' + cloudinaryThumb(r.secure_url) + '" alt="" loading="lazy" />' +
            '<span class="cms-media-item-size">' + r.width + '\u00d7' + r.height + '</span>';
          item.addEventListener("click", () => {
            finish({ url: r.secure_url, publicId: r.public_id });
          });
          grid.appendChild(item);
        });
      } catch {
        grid.innerHTML = '<p class="cms-media-empty">Error al cargar im\u00e1genes</p>';
      }
    }

    modal.appendChild(header);
    modal.appendChild(tabs);
    modal.appendChild(uploadBar);
    modal.appendChild(grid);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // Close on Escape
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { finish(null); document.removeEventListener("keydown", onKey); }
    }
    document.addEventListener("keydown", onKey);

    // Load initial folder
    loadImages("maralma");
  });
}

/* ── Make image elements editable (opens media picker) ── */
function enableImageEditing(el: HTMLElement, key: string) {
  let container: HTMLElement;

  if (el.tagName === "IMG") {
    // For <img> elements, wrap in a new div
    const wrapper = document.createElement("div");
    wrapper.className = "cms-img-wrapper";
    wrapper.style.position = "relative";
    wrapper.style.display = "inline-block";
    el.parentNode?.insertBefore(wrapper, el);
    wrapper.appendChild(el);
    container = wrapper;
  } else {
    // For background-image divs, use the element itself as container
    const elPos = getComputedStyle(el).position;
    if (elPos === "static") el.style.position = "relative";
    el.classList.add("cms-img-wrapper");
    container = el;
  }

  const overlay = document.createElement("div");
  overlay.className = "cms-img-overlay";
  overlay.innerHTML =
    '<button class="cms-img-btn">' +
      '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">' +
        '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>' +
        '<circle cx="12" cy="13" r="4"/>' +
      '</svg>' +
      ' Cambiar foto' +
    '</button>';
  container.appendChild(overlay);

  overlay.querySelector(".cms-img-btn")!.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const result = await openMediaPicker();
    if (!result) return;

    // Update the element
    if (el.tagName === "IMG") {
      (el as HTMLImageElement).src = result.url;
    } else {
      el.style.backgroundImage = "url(" + result.url + ")";
      el.style.backgroundSize = "cover";
      el.style.backgroundPosition = "center";
    }
    await saveContent(key, result.url, result.publicId);
  });

  // ── Position grid (only for background-image elements) ──
  if (el.tagName !== "IMG") {
    const positions = [
      { label: "\u2196", value: "top left" },
      { label: "\u2191", value: "top center" },
      { label: "\u2197", value: "top right" },
      { label: "\u2190", value: "center left" },
      { label: "\u00b7", value: "center center" },
      { label: "\u2192", value: "center right" },
      { label: "\u2199", value: "bottom left" },
      { label: "\u2193", value: "bottom center" },
      { label: "\u2198", value: "bottom right" },
    ];

    const posGrid = document.createElement("div");
    posGrid.className = "cms-pos-grid";

    const currentPos = el.style.backgroundPosition || "center";

    positions.forEach((p) => {
      const btn = document.createElement("button");
      btn.className = "cms-pos-btn";
      btn.textContent = p.label;
      btn.title = p.value;
      // Normalize for comparison
      const normalizedCurrent = currentPos.replace("center center", "center");
      const normalizedValue = p.value.replace("center center", "center");
      if (normalizedCurrent === normalizedValue || normalizedCurrent === p.value) {
        btn.classList.add("active");
      }
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.style.backgroundPosition = p.value;
        posGrid.querySelectorAll(".cms-pos-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        await saveContent(key + ".position", p.value);
      });
      posGrid.appendChild(btn);
    });

    container.appendChild(posGrid);
  }
}

/* ── Apply overrides to DOM ── */
function applyOverrides(overrides: Record<string, { value: string; type: string; publicId?: string }>) {
  document.querySelectorAll<HTMLElement>("[data-cms]").forEach((el) => {
    const key = el.getAttribute("data-cms")!;
    const o = overrides[key];
    if (o && o.type === "text") el.innerText = o.value;
  });
  document.querySelectorAll<HTMLElement>("[data-cms-img]").forEach((el) => {
    const key = el.getAttribute("data-cms-img")!;
    const o = overrides[key];
    if (o && o.type === "image") {
      if (el.tagName === "IMG") {
        (el as HTMLImageElement).src = o.value;
      } else {
        el.style.backgroundImage = "url(" + o.value + ")";
        el.style.backgroundSize = "cover";
        const pos = overrides[key + ".position"];
        el.style.backgroundPosition = (pos && pos.type === "text") ? pos.value : "center";
      }
    } else {
      // No image override, but maybe a position override for the default SSR image
      const pos = overrides[key + ".position"];
      if (pos && pos.type === "text") {
        el.style.backgroundPosition = pos.value;
      }
    }
  });
}

/* ── Inject CMS styles ── */
function injectStyles() {
  const style = document.createElement("style");
  style.textContent =
    '#cms-admin-bar {' +
      'position:fixed;top:0;left:0;right:0;z-index:9999;' +
      'height:36px;background:#1e3a4f;' +
      'display:flex;align-items:center;padding:0 20px;' +
      "font-family:'Jost',sans-serif;font-size:11px;" +
      'color:rgba(255,255,255,0.85);letter-spacing:0.08em;' +
    '}' +
    '.cms-bar-indicator{width:6px;height:6px;border-radius:50%;background:#25d366;margin-right:10px;animation:cmsPulse 2s ease-in-out infinite}' +
    '@keyframes cmsPulse{0%,100%{opacity:1}50%{opacity:0.4}}' +
    '.cms-bar-right{margin-left:auto;display:flex;align-items:center;gap:14px}' +
    '.cms-bar-status{font-size:10px;letter-spacing:0.1em;transition:opacity 0.3s}' +
    '.cms-status-saving{color:#a8c4c8}' +
    '.cms-status-saved{color:#25d366}' +
    '.cms-status-error{color:#ff6b6b}' +
    ".cms-bar-btn{background:rgba(255,255,255,0.12);border:0.5px solid rgba(255,255,255,0.25);color:rgba(255,255,255,0.8);padding:4px 14px;font-family:'Jost',sans-serif;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;cursor:pointer;transition:all 0.2s}" +
    '.cms-bar-btn:hover{background:rgba(255,255,255,0.25);color:#fff}' +

    /* Editable text */
    '.cms-editable{cursor:pointer;transition:outline 0.2s,outline-offset 0.2s;outline:2px solid transparent;outline-offset:4px}' +
    '.cms-editable:hover{outline-color:rgba(30,58,79,0.35)}' +
    '.cms-editable.cms-editing{outline-color:#1e3a4f;outline-style:solid;background:rgba(30,58,79,0.04)}' +

    /* Editable images */
    '.cms-img-wrapper{position:relative}' +
    '.cms-img-overlay{position:absolute;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;background:rgba(15,26,32,0.5);opacity:0;transition:opacity 0.3s;cursor:pointer}' +
    '.cms-img-wrapper:hover .cms-img-overlay{opacity:1}' +
    ".cms-img-btn{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.95);color:#1e3a4f;padding:10px 18px;font-family:'Jost',sans-serif;font-size:11px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer;transition:all 0.2s;border:none}" +
    '.cms-img-btn:hover{background:#fff}' +
    '.cms-img-btn svg{width:16px;height:16px}' +

    /* Media picker modal */
    '.cms-media-backdrop{position:fixed;inset:0;z-index:10000;background:rgba(15,26,32,0.6);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}' +
    ".cms-media-modal{background:#fdfcfa;width:90vw;max-width:860px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;font-family:'Jost',sans-serif}" +
    '.cms-media-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 16px;border-bottom:0.5px solid #e8e2d8}' +
    ".cms-media-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;color:#1e3a4f}" +
    '.cms-media-close{background:none;border:none;font-size:24px;color:#1e3a4f;cursor:pointer;padding:4px 8px;opacity:0.6;transition:opacity 0.2s}' +
    '.cms-media-close:hover{opacity:1}' +
    '.cms-media-tabs{display:flex;gap:4px;padding:16px 24px 12px;flex-wrap:wrap}' +
    ".cms-media-tab{font-family:'Jost',sans-serif;font-size:10px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:rgba(15,26,32,0.5);background:transparent;border:0.5px solid #e8e2d8;padding:7px 14px;cursor:pointer;transition:all 0.2s}" +
    '.cms-media-tab:hover{border-color:#1e3a4f;color:#1e3a4f}' +
    '.cms-media-tab.active{background:#1e3a4f;color:#fdfcfa;border-color:#1e3a4f}' +
    '.cms-media-upload-bar{display:flex;align-items:center;gap:12px;padding:0 24px 12px}' +
    ".cms-media-upload-btn{display:flex;align-items:center;gap:6px;font-family:'Jost',sans-serif;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#1e3a4f;border:0.5px solid #1e3a4f;padding:7px 16px;cursor:pointer;transition:all 0.2s;background:transparent}" +
    '.cms-media-upload-btn:hover{background:#1e3a4f;color:#fdfcfa}' +
    '.cms-media-upload-btn svg{width:14px;height:14px}' +
    '.cms-media-upload-status{font-size:10px;letter-spacing:0.1em;color:#a8c4c8}' +
    '.cms-media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;padding:16px 24px 24px;overflow-y:auto;flex:1;min-height:200px}' +
    '.cms-media-item{position:relative;aspect-ratio:1;overflow:hidden;cursor:pointer;border:2px solid transparent;transition:border-color 0.2s,transform 0.2s;background:#e8e2d8}' +
    '.cms-media-item:hover{border-color:#a8c4c8;transform:scale(1.02)}' +
    '.cms-media-item img{width:100%;height:100%;object-fit:cover;display:block}' +
    '.cms-media-item-size{position:absolute;bottom:4px;right:6px;font-size:9px;color:rgba(255,255,255,0.7);background:rgba(0,0,0,0.4);padding:2px 6px;letter-spacing:0.06em}' +
    '.cms-media-loading,.cms-media-empty{grid-column:1/-1;text-align:center;font-size:13px;color:rgba(15,26,32,0.4);padding:40px 0}' +

    /* Position grid */
    '.cms-pos-grid{position:absolute;bottom:10px;right:10px;display:grid;grid-template-columns:repeat(3,28px);gap:3px;background:rgba(30,58,79,0.85);padding:6px;border-radius:4px;opacity:0;transition:opacity 0.2s;z-index:11}' +
    '.cms-img-wrapper:hover .cms-pos-grid{opacity:1}' +
    '.cms-pos-btn{width:28px;height:28px;background:rgba(255,255,255,0.15);border:none;color:white;font-size:12px;cursor:pointer;border-radius:2px;transition:background 0.2s;padding:0;line-height:28px;text-align:center}' +
    '.cms-pos-btn:hover{background:rgba(255,255,255,0.35)}' +
    '.cms-pos-btn.active{background:#a8c4c8;color:#1e3a4f}' +

    /* Responsive media picker */
    '@media(max-width:768px){.cms-media-modal{width:96vw;max-height:92vh}.cms-media-grid{grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:6px;padding:12px 16px}}';

  document.head.appendChild(style);
}

/* ── INIT ── */
async function initCMS() {
  if (window.location.pathname.startsWith("/admin")) return;

  authToken = await checkAdmin();
  if (!authToken) return;

  injectStyles();

  const overrides = await fetchOverrides();
  applyOverrides(overrides);

  createAdminBar(async () => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      await sb.auth.signOut();
    } catch { /* ignore */ }
    window.location.reload();
  });

  document.querySelectorAll<HTMLElement>("[data-cms]").forEach((el) => {
    enableTextEditing(el, el.getAttribute("data-cms")!);
  });

  document.querySelectorAll<HTMLElement>("[data-cms-img]").forEach((el) => {
    enableImageEditing(el, el.getAttribute("data-cms-img")!);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCMS);
} else {
  initCMS();
}
