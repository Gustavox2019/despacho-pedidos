import { useState, useMemo } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { fmtTime, calcularProgreso } from "../helpers.js";

function BarraProgreso({ pedido }) {
  const pct = calcularProgreso(pedido);
  return (
    <div className="progreso-wrap">
      <div className="progreso-track">
        <div className={`progreso-fill ${pct >= 100 ? "completo" : ""}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="progreso-label">{pct}%</div>
    </div>
  );
}

function coincideDia(pedido, fecha) {
  if (!fecha) return true;
  const iso = new Date(pedido.creadoEn).toISOString().slice(0, 10);
  return iso === fecha;
}

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

const FILTROS_VACIOS = { fecha: "", fechaDesde: "", fechaHasta: "", cliente: "", idPedido: "", vendedor: "", almacenero: "" };

function FiltrosPedidos({ pedidos, filtros, setFiltros, modo, mostrarFiltroVendedor, mostrarFiltroAlmacenero }) {
  const vendedores = useMemo(() => valoresUnicos(pedidos, "vendedorNombre"), [pedidos]);
  const almaceneros = useMemo(() => valoresUnicos(pedidos, "almaceneroNombre"), [pedidos]);

  return (
    <div className="filter-bar">
      {modo === "dia" && (
        <input type="date" value={filtros.fecha} onChange={e => setFiltros(f => ({ ...f, fecha: e.target.value }))} />
      )}
      {modo === "rango" && (
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

function aplicarFiltros(lista, filtros, modoFecha) {
  let out = lista;
  if (modoFecha === "dia") out = out.filter(p => coincideDia(p, filtros.fecha));
  else if (modoFecha === "rango") out = out.filter(p => coincideRango(p, filtros.fechaDesde, filtros.fechaHasta));
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

export default function ListaPedidos({ pedidos, user, onOpen, loading }) {
  const esVendedor = user.rol === "vendedor";
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [tab, setTab] = useState("pendientes"); // pendientes | mis-tomados | todos

  // Ambos roles ven las mismas pestañas y filtros ahora, porque cualquiera
  // puede tomar y preparar pedidos, no solo el almacén.
  const modoFecha = tab === "pendientes" ? "ninguno" : "rango";

  const filtrados = useMemo(() => {
    let lista = [...pedidos];
    if (tab === "pendientes") lista = lista.filter(p => p.estado === "pendiente");
    else if (tab === "mis-tomados") lista = lista.filter(p => p.almaceneroId === user.id && p.estado !== "pendiente");
    lista = aplicarFiltros(lista, filtros, modoFecha);
    return lista.sort((a, b) => b.creadoEn - a.creadoEn);
  }, [pedidos, filtros, tab, user.id, modoFecha]);

  return (
    <div>
      <div className="tabs">
        <button className={`tab-btn ${tab === "pendientes" ? "active" : ""}`} onClick={() => setTab("pendientes")}>Pendientes</button>
        <button className={`tab-btn ${tab === "mis-tomados" ? "active" : ""}`} onClick={() => setTab("mis-tomados")}>Tomados por mí</button>
        <button className={`tab-btn ${tab === "todos" ? "active" : ""}`} onClick={() => setTab("todos")}>Todos</button>
      </div>

      <FiltrosPedidos
        pedidos={pedidos}
        filtros={filtros}
        setFiltros={setFiltros}
        modo={modoFecha}
        mostrarFiltroVendedor={true}
        mostrarFiltroAlmacenero={true}
      />

      {loading ? (
        <div className="empty-state"><Loader2 className="spin" size={26} /></div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <ClipboardList size={30} style={{ opacity: 0.4, marginBottom: 10 }} />
          <div>
            {pedidos.length === 0
              ? (esVendedor ? "Aún no creaste ningún pedido." : "No hay pedidos por ahora.")
              : "Ningún pedido coincide con el filtro."}
          </div>
        </div>
      ) : (
        filtrados.map(p => {
          const notifPendiente = esVendedor && p.estado === "finalizado" && !p.vistoPorVendedor;
          return (
            <div className="pedido-row" key={p.id} onClick={() => onOpen(p.id)}>
              {notifPendiente && <span className="notif-dot" />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="pedido-id">{p.id}</div>
                <div className="pedido-cliente">{p.cliente}</div>
                <div className="pedido-meta">{p.items.length} códigos · {fmtTime(p.creadoEn)}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  <span className="name-chip vendedor">V: {p.vendedorNombre}</span>
                  {p.almaceneroNombre && <span className="name-chip almacenero">A: {p.almaceneroNombre}</span>}
                  {p.modoAtencion && (
                    <span className={`name-chip ${p.modoAtencion === "separar" ? "almacenero" : "vendedor"}`}>
                      {p.modoAtencion === "separar" ? "Separar" : "Confirmar"}
                    </span>
                  )}
                </div>
                {p.estado !== "pendiente" && <BarraProgreso pedido={p} />}
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
