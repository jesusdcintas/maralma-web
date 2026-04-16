import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../lib/supabase-admin";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const { nombre, email, telefono, tipo_evento, fecha_evento, comensales, zona, mensaje } = body;

    if (!nombre || !email) {
      return new Response(JSON.stringify({ error: "Nombre y email son obligatorios." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { error } = await supabaseAdmin.from("quotes").insert({
      nombre,
      email,
      telefono: telefono || null,
      tipo_evento: tipo_evento || null,
      fecha_evento: fecha_evento || null,
      comensales: comensales ? parseInt(comensales, 10) : null,
      zona: zona || null,
      mensaje: mensaje || null,
    });

    if (error) {
      return new Response(JSON.stringify({ error: "Error al guardar la solicitud." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Error del servidor." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
