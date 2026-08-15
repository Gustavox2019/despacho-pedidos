import { useState, useMemo } from "react";
import { ClipboardList, Loader2, Pin } from "lucide-react";
import { fmtTime, calcularProgreso } from "../helpers.js";
import { api } from "../api.js";

function coincideRango(pedido, desde, hasta) {
  const iso = new Date(pedido.creadoEn).toISOString().slice(0, 10);
  if (desde && iso < desde) return false;
  if (hasta && iso > hasta) return false;
  return true;
}

function valoresUnicos(pedidos, campo) {
  const set = new Set();
  for (const p of pedidos) if (p[campo]) set.add(p[campo]);
  return [...set].sort();
}

const FILTROS_VACIOS = { fechaDesde: "", fechaHasta: "", cliente: "", idPedido: "", vendedor: "", almacenero: "" };

function FiltrosPedidos({ pedidos, filtros, setFiltros, mostrarFecha, mostrarFiltroVendedor, mostrarFiltroAlmacenero }) {
  const vendedores = useMemo(() => valoresUnicos(pedidos, "vendedorNombre"), [pedidos]);
  const almaceneros = useMemo(() => valoresUnicos(pedidos, "almaceneroNombre"), [pedidos]);

  return (
    <div className="filter-bar">
      {mostrarFecha && (
        <>
          <input type="date" title="Desde" value={filtros.fechaDesde} onChange={e => setFiltros(f => ({ ...f, fechaDesde: e.target.value }))} />
          <input type="date" title="Hasta" value={filtros.fechaHasta} onChange={e => setFiltros(f => ({ ...f, fechaHasta: e.target.value }))} />
        </>
      )}
      <input type="text" placeholder="Cliente…" value={filtros.cliente}
        onChange={e => setFiltros(f => ({ ...f, cliente: e.target.value }))} />
      <input type="text" placeholder="ID pedido…" value={filtros.idPedido}
        onChange={e => setFiltros(f => ({ ...f, idPedido: e.target.value }))} />
      {mostrarFiltroVendedor && (
        <select value={filtros.vendedor} onChange={e => setFiltros(f => ({ ...f, vendedor: e.target.value }))}>
          <option value="">Todos los vendedores</option>
          {vendedores.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      )}
      {mostrarFiltroAlmacenero && (
        <select value={filtros.almacenero} onChange={e => setFiltros(f => ({ ...f, almacenero: e.target.value }))}>
          <option value="">Todos los almaceneros</option>
          {almaceneros.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      )}
    </div>
  );
}

function aplicarFiltros(lista, filtros, mostrarFecha) {
  let out = lista;
  if (mostrarFecha) out = out.filter(p => coincideRango(p, filtros.fechaDesde, filtros.fechaHasta));
  if (filtros.cliente.trim()) {
    const q = filtros.cliente.trim().toLowerCase();
    out = out.filter(p => p.cliente.toLowerCase().includes(q));
  }
  if (filtros.idPedido.trim()) {
    const q = filtros.idPedido.trim().toLowerCase();
    out = out.filter(p => p.id.toLowerCase().includes(q));
  }
  if (filtros.vendedor) out = out.filter(p => p.vendedorNombre === filtros.vendedor);
  if (filtros.almacenero) out = out.filter(p => p.almaceneroNombre === filtros.almacenero);
  return out;
}

export default function ListaPedidos({ pedidos, user, onOpen, loading, onPedidoActualizado }) {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [tab, setTab] = useState(user.rol === "vendedor" ? "mis-pedidos" : "pendientes");

  const mostrarFecha = tab !== "pendientes";
  const mostrarFiltroAlmacenero = tab === "todos";

  const filtrados = useMemo(() => {
    let lista = [...pedidos];
    if (tab === "mis-pedidos") lista = lista.filter(p => p.vendedorId === user.id);
    else if (tab === "pendientes") lista = lista.filter(p => p.estado === "pendiente");
    else if (tab === "mis-tomados") lista = lista.filter(p => p.almaceneroId === user.id && p.estado !== "pendiente");
    // "todos": sin filtro adicional

    lista = aplicarFiltros(lista, filtros, mostrarFecha);
    return lista.sort((a, b) => (b.anclado ? 1 : 0) - (a.anclado ? 1 : 0) || b.creadoEn - a.creadoEn);
  }, [pedidos, filtros, tab, user.id, mostrarFecha]);

  async function togglePin(e, pedido) {
    e.stopPropagation(); // no abrir el detalle al tocar el pin
    try {
      await api.actualizarPedido(pedido.id, { anclado: !pedido.anclado });
      if (onPedidoActualizado) onPedidoActualizado();
    } catch (err) {
      console.error("No se pudo anclar/desanclar:", err);
    }
  }

  return (
    <div>
      {user.rol !== "vendedor" && (
        <div className="tabs">
          <button className={`tab-btn ${tab === "pendientes" ? "active" : ""}`} onClick={() => setTab("pendientes")}>Pendientes</button>
          <button className={`tab-btn ${tab === "mis-tomados" ? "active" : ""}`} onClick={() => setTab("mis-tomados")}>Tomados por mí</button>
          <button className={`tab-btn ${tab === "todos" ? "active" : ""}`} onClick={() => setTab("todos")}>Todos</button>
        </div>
      )}

      <FiltrosPedidos
        pedidos={pedidos}
        filtros={filtros}
        setFiltros={setFiltros}
        mostrarFecha={mostrarFecha}
        mostrarFiltroVendedor={user.rol !== "vendedor" && tab !== "mis-pedidos"}
        mostrarFiltroAlmacenero={mostrarFiltroAlmacenero}
      />

      {loading ? (
        <div className="empty-state"><Loader2 className="spin" size={26} /></div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <ClipboardList size={30} style={{ opacity: 0.4, marginBottom: 10 }} />
          <div>No hay pedidos en esta pestaña o filtro.</div>
        </div>
      ) : (
        filtrados.map(p => {
          const notifFinalizado = p.vendedorId === user.id && p.estado === "finalizado" && !p.vistoPorVendedor;
          const notifPedidoNuevo = user.rol === "almacenero" && p.estado === "pendiente" && !p.vistoPorAlmacen;
          const notifChat = user.rol === "vendedor" ? (p.vendedorId === user.id && !p.chatVistoVendedor) : (p.almaceneroId === user.id && !p.chatVistoAlmacen);
          const progreso = calcularProgreso(p);
          return (
            <div className={`pedido-row ${p.anclado ? "anclado" : ""}`} key={p.id} onClick={() => onOpen(p.id)}>
              {(notifFinalizado || notifPedidoNuevo) && <span className="notif-dot" />}
              <button
                className={`pin-btn ${p.anclado ? "activo" : ""}`}
                title={p.anclado ? "Desanclar" : "Anclar arriba"}
                onClick={e => togglePin(e, p)}
              >
                <Pin size={15} fill={p.anclado ? "currentColor" : "none"} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="pedido-id">{p.id}</div>
                <div className="pedido-cliente">{p.cliente}</div>
                <div className="pedido-meta">
                  {p.items.length} códigos · {fmtTime(p.creadoEn)}
                  {p.estado === "finalizado" && p.finalizadoEn && ` · Finalizado ${fmtTime(p.finalizadoEn)}`}
                  {p.estado === "cancelado" && p.canceladoEn && ` · Cancelado ${fmtTime(p.canceladoEn)}`}
                  {p.historial && p.historial.length > 0 && (
                    <span style={{ color: "var(--amber)" }}> · con historial</span>
                  )}
                  {notifChat && <span className="chat-unread-dot"> · ● mensaje nuevo</span>}
                </div>
                {(p.estado === "tomado" || p.estado === "finalizado") && (
                  <div className="progreso-wrap">
                    <div className="progreso-track">
                      <div className={`progreso-fill ${progreso >= 100 ? "completo" : ""}`} style={{ width: `${progreso}%` }} />
                    </div>
                    <div className="progreso-label">{progreso}%</div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  <span className="name-chip vendedor">V: {p.vendedorNombre}</span>
                  {p.almaceneroNombre && <span className="name-chip almacenero">A: {p.almaceneroNombre}</span>}
                </div>
              </div>
              <span className={`status-pill status-${p.estado}`}>
                {p.estado === "pendiente" && "Pendiente"}
                {p.estado === "tomado" && "En proceso"}
                {p.estado === "finalizado" && "Finalizado"}
                {p.estado === "cancelado" && "Cancelado"}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
