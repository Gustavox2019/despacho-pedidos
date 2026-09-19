import { useState, useMemo } from "react";
import { ClipboardList, Loader2, Pin, Search, X, Lock } from "lucide-react";
import { fmtTime, calcularProgreso, normCode } from "../helpers.js";
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

function EtiquetaEstado({ estado }) {
  return (
    <>
      {estado === "pendiente" && "Pendiente"}
      {estado === "tomado" && "En proceso"}
      {estado === "finalizado" && "Finalizado"}
      {estado === "cancelado" && "Cancelado"}
      {estado === "despachado" && "Despachado"}
    </>
  );
}

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

function tabInicial(rol) {
  if (rol === "almacenero") return "pendientes";
  if (rol === "paqueteria") return "por-despachar";
  return "mis-pedidos"; // vendedor
}

export default function ListaPedidos({ pedidos, user, onOpen, loading, onPedidoActualizado }) {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [tab, setTab] = useState(tabInicial(user.rol));
  const [buscarCodigo, setBuscarCodigo] = useState("");

  const mostrarFecha = tab !== "pendientes" && tab !== "por-despachar";
  const mostrarFiltroAlmacenero = tab === "todos";

  // Buscador por código: mientras haya texto acá, se ignoran las pestañas
  // y filtros normales — busca en TODOS los pedidos (los que tenga
  // cargados este usuario) cuáles tienen ese código, sirve para ubicar en
  // qué pedidos quedó un producto que llegó mal o dañado. Los pedidos
  // ajenos (vendedor viendo pedidos de otros) no traen códigos, así que
  // quedan fuera de la búsqueda automáticamente.
  const resultadosBusqueda = useMemo(() => {
    const q = normCode(buscarCodigo);
    if (!q || q.length < 2) return null;
    const resultados = [];
    for (const p of pedidos) {
      const coincidencias = (p.items || []).filter(it =>
        normCode(it.codigo).includes(q) || (it.codigosAlternos || []).some(alt => normCode(alt).includes(q))
      );
      if (coincidencias.length > 0) resultados.push({ pedido: p, coincidencias });
    }
    return resultados.sort((a, b) => b.pedido.creadoEn - a.pedido.creadoEn);
  }, [pedidos, buscarCodigo]);

  const filtrados = useMemo(() => {
    let lista = [...pedidos];
    if (tab === "mis-pedidos") lista = lista.filter(p => p.vendedorId === user.id);
    else if (tab === "pendientes") lista = lista.filter(p => p.estado === "pendiente");
    else if (tab === "mis-tomados") lista = lista.filter(p => p.almaceneroId === user.id && p.estado !== "pendiente");
    else if (tab === "por-despachar") lista = lista.filter(p => p.estado === "finalizado" && p.tipo === "separar");
    else if (tab === "despachados") lista = lista.filter(p => p.estado === "despachado");
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
      <div className="search-code-bar">
        <Search size={15} />
        <input
          type="text"
          placeholder="Buscar en qué pedido(s) está un código…"
          value={buscarCodigo}
          onChange={e => setBuscarCodigo(e.target.value)}
        />
        {buscarCodigo && (
          <button className="icon-btn" onClick={() => setBuscarCodigo("")} title="Limpiar búsqueda">
            <X size={15} />
          </button>
        )}
      </div>

      {resultadosBusqueda !== null ? (
        resultadosBusqueda.length === 0 ? (
          <div className="empty-state">
            <Search size={30} style={{ opacity: 0.4, marginBottom: 10 }} />
            <div>Ningún pedido tiene un código que coincida con "{buscarCodigo}".</div>
          </div>
        ) : (
          <div>
            <div className="helper-text" style={{ margin: "4px 0 10px" }}>
              {resultadosBusqueda.length} pedido(s) con ese código:
            </div>
            {resultadosBusqueda.map(({ pedido: p, coincidencias }) => (
              <div className="pedido-row" key={p.id} onClick={() => onOpen(p.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="pedido-id">{p.id}</div>
                  <div className="pedido-cliente">{p.cliente}</div>
                  <div className="pedido-meta">{fmtTime(p.creadoEn)} · V: {p.vendedorNombre}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {coincidencias.map(it => (
                      <span key={it.id} className="dup-chip">
                        {it.codigo} × {it.cantidad}
                        {it.check === "ok" && " · ✓"}
                        {it.check === "no" && " · ✕"}
                      </span>
                    ))}
                  </div>
                </div>
                <span className={`status-pill status-${p.estado}`}><EtiquetaEstado estado={p.estado} /></span>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="tabs">
            {user.rol === "almacenero" && (
              <>
                <button className={`tab-btn ${tab === "pendientes" ? "active" : ""}`} onClick={() => setTab("pendientes")}>Pendientes</button>
                <button className={`tab-btn ${tab === "mis-tomados" ? "active" : ""}`} onClick={() => setTab("mis-tomados")}>Tomados por mí</button>
                <button className={`tab-btn ${tab === "todos" ? "active" : ""}`} onClick={() => setTab("todos")}>Todos</button>
              </>
            )}
            {user.rol === "vendedor" && (
              <>
                <button className={`tab-btn ${tab === "mis-pedidos" ? "active" : ""}`} onClick={() => setTab("mis-pedidos")}>Mis pedidos</button>
                <button className={`tab-btn ${tab === "todos" ? "active" : ""}`} onClick={() => setTab("todos")}>Todos</button>
              </>
            )}
            {user.rol === "paqueteria" && (
              <>
                <button className={`tab-btn ${tab === "por-despachar" ? "active" : ""}`} onClick={() => setTab("por-despachar")}>Por despachar</button>
                <button className={`tab-btn ${tab === "despachados" ? "active" : ""}`} onClick={() => setTab("despachados")}>Despachados</button>
              </>
            )}
          </div>

          <FiltrosPedidos
            pedidos={pedidos}
            filtros={filtros}
            setFiltros={setFiltros}
            mostrarFecha={mostrarFecha}
            mostrarFiltroVendedor={user.rol === "almacenero" && tab !== "mis-pedidos"}
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
              // Pedido de otro vendedor: el backend ya lo manda "vacío" de
              // contenido (sin códigos ni foto) — acá además se bloquea el
              // click y se esconde cualquier dato de lo que contiene.
              if (p.oculto) {
                return (
                  <div className="pedido-row pedido-oculto" key={p.id}>
                    <Lock size={15} style={{ color: "var(--muted2)", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="pedido-id">{p.id}</div>
                      <div className="pedido-cliente">{p.cliente}</div>
                      <div className="pedido-meta">{fmtTime(p.creadoEn)} · V: {p.vendedorNombre}</div>
                    </div>
                    <span className={`status-pill status-${p.estado}`}><EtiquetaEstado estado={p.estado} /></span>
                  </div>
                );
              }

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
                      {p.estado === "despachado" && p.despachadoEn && ` · Despachado ${fmtTime(p.despachadoEn)}`}
                      {p.estado === "cancelado" && p.canceladoEn && ` · Cancelado ${fmtTime(p.canceladoEn)}`}
                      {p.historial && p.historial.length > 0 && (
                        <span style={{ color: "var(--amber)" }}> · con historial</span>
                      )}
                      {(() => {
                        const conDetalle = p.items.filter(it => it.texto && it.texto.trim()).length;
                        return conDetalle > 0 ? (
                          <span style={{ color: "var(--amber)", fontWeight: 700 }}> · ⚠ {conDetalle} con detalle</span>
                        ) : null;
                      })()}
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
                      {p.despachadoPorNombre && <span className="name-chip paqueteria">P: {p.despachadoPorNombre}</span>}
                    </div>
                  </div>
                  <span className={`status-pill status-${p.estado}`}><EtiquetaEstado estado={p.estado} /></span>
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
