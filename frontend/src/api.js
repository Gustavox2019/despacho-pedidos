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
  listarPedidos: (opciones = {}) => {
    const params = new URLSearchParams();
    if (opciones.vendedorId) params.set("vendedorId", opciones.vendedorId);
    if (opciones.almaceneroId) params.set("almaceneroId", opciones.almaceneroId);
    if (opciones.viewerId) params.set("viewerId", opciones.viewerId);
    if (opciones.ocultarAjenos) params.set("ocultarAjenos", "1");
    if (opciones.completo) params.set("completo", "1");
    const qs = params.toString();
    return request("/pedidos" + (qs ? `?${qs}` : ""));
  },
  // Búsqueda en TODO el historial, por filtros y/o código — no trae el
  // historial completo, solo lo que calza con lo que se busca.
  buscarPedidos: (filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros.codigo) params.set("codigo", filtros.codigo);
    if (filtros.cliente) params.set("cliente", filtros.cliente);
    if (filtros.idPedido) params.set("idPedido", filtros.idPedido);
    if (filtros.vendedor) params.set("vendedor", filtros.vendedor);
    if (filtros.almacenero) params.set("almacenero", filtros.almacenero);
    if (filtros.fechaDesde) params.set("fechaDesde", filtros.fechaDesde);
    if (filtros.fechaHasta) params.set("fechaHasta", filtros.fechaHasta);
    if (filtros.estados && filtros.estados.length) params.set("estados", filtros.estados.join(","));
    if (filtros.viewerId) params.set("viewerId", filtros.viewerId);
    if (filtros.ocultarAjenos) params.set("ocultarAjenos", "1");
    return request("/pedidos/buscar?" + params.toString());
  },
  obtenerPedido: (id, liviano) => request(`/pedidos/${id}${liviano ? "?liviano=1" : ""}`),
  actualizarPedido: (id, patch) => request(`/pedidos/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  listarChat: (pedidoId, solicitanteId) => request(`/chat/${pedidoId}?solicitanteId=${encodeURIComponent(solicitanteId)}`),
  enviarChat: (pedidoId, msg) => request(`/chat/${pedidoId}`, { method: "POST", body: JSON.stringify(msg) }),
  transcribir: (imageBase64, mediaType) => request("/ocr", { method: "POST", body: JSON.stringify({ imageBase64, mediaType }) }),
  escanearProducto: (imageBase64, mediaType) => request("/escanear", { method: "POST", body: JSON.stringify({ imageBase64, mediaType }) }),
  matchLista: (items) => request("/match", { method: "POST", body: JSON.stringify({ items }) }),
  buscarCodigos: (q) => request(`/codigos/buscar?q=${encodeURIComponent(q)}`),
  obtenerClavePublicaPush: () => request("/push/clave-publica"),
  suscribirPush: (payload) => request("/push/suscribir", { method: "POST", body: JSON.stringify(payload) }),
  desuscribirPush: (endpoint) => request("/push/desuscribir", { method: "POST", body: JSON.stringify({ endpoint }) }),
  loginGoogle: (credential) => request("/auth/google", { method: "POST", body: JSON.stringify({ credential }) }),
  guardarRol: (payload) => request("/auth/rol", { method: "POST", body: JSON.stringify(payload) })
};
