// En local usa el proxy de Vite ("/api"). En producción (Vercel/Netlify),
// se configura VITE_API_BASE_URL con la URL del backend desplegado en Render.
const BASE = (import.meta.env.VITE_API_BASE_URL || "") + "/api";

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error de red");
  return data;
}

export const api = {
  crearPedido: (payload) => request("/pedidos", { method: "POST", body: JSON.stringify(payload) }),
  listarPedidos: (vendedorId) => request("/pedidos" + (vendedorId ? `?vendedorId=${encodeURIComponent(vendedorId)}` : "")),
  obtenerPedido: (id) => request(`/pedidos/${id}`),
  actualizarPedido: (id, patch) => request(`/pedidos/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  listarChat: (pedidoId) => request(`/chat/${pedidoId}`),
  enviarChat: (pedidoId, msg) => request(`/chat/${pedidoId}`, { method: "POST", body: JSON.stringify(msg) }),
  transcribir: (imageBase64, mediaType) => request("/ocr", { method: "POST", body: JSON.stringify({ imageBase64, mediaType }) }),
  matchLista: (items) => request("/match", { method: "POST", body: JSON.stringify({ items }) }),
  loginGoogle: (credential) => request("/auth/google", { method: "POST", body: JSON.stringify({ credential }) }),
  guardarRol: (payload) => request("/auth/rol", { method: "POST", body: JSON.stringify(payload) })
};
