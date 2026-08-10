import { useState, useMemo } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { fmtTime } from "../helpers.js";

function coincideDia(pedido, fecha) {
  if (!fecha) return true;
  const d = new Date(pedido.creadoEn);
  const iso = d.toISOString().slice(0, 10);
  return iso === fecha;
}

export default function ListaPedidos({ pedidos, user, onOpen, loading }) {
  const esVendedor = user.rol === "vendedor";
  const [fecha, setFecha] = useState("");
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [tab, setTab] = useState("pendientes"); // pendientes | mis-tomados | todos

  const filtrados = useMemo(() => {
    let lista = [...pedidos];

    if (esVendedor) {
      lista = lista.filter(p => coincideDia(p, fecha));
      if (busquedaCliente.trim()) {
        const q = busquedaCliente.trim().toLowerCase();
        lista = lista.filter(p => p.cliente.toLowerCase().includes(q));
      }
    } else {
      if (tab === "pendientes") lista = lista.filter(p => p.estado === "pendiente");
      else if (tab === "mis-tomados") lista = lista.filter(p => p.almaceneroId === user.id && p.estado !== "pendiente");
      // "todos" no filtra
    }

    return lista.sort((a, b) => b.creadoEn - a.creadoEn);
  }, [pedidos, esVendedor, fecha, busquedaCliente, tab, user.id]);

  return (
    <div>
      {esVendedor ? (
        <div className="filter-bar">
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          <input type="text" placeholder="Buscar por cliente…" value={busquedaCliente}
            onChange={e => setBusquedaCliente(e.target.value)} />
        </div>
      ) : (
        <div className="tabs">
          <button className={`tab-btn ${tab === "pendientes" ? "active" : ""}`} onClick={() => setTab("pendientes")}>Pendientes</button>
          <button className={`tab-btn ${tab === "mis-tomados" ? "active" : ""}`} onClick={() => setTab("mis-tomados")}>Tomados por mí</button>
          <button className={`tab-btn ${tab === "todos" ? "active" : ""}`} onClick={() => setTab("todos")}>Todos</button>
        </div>
      )}

      {loading ? (
        <div className="empty-state"><Loader2 className="spin" size={26} /></div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <ClipboardList size={30} style={{ opacity: 0.4, marginBottom: 10 }} />
          <div>
            {esVendedor
              ? (pedidos.length === 0 ? "Aún no creaste ningún pedido." : "Ningún pedido coincide con el filtro.")
              : "No hay pedidos en esta pestaña."}
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
                <div className="pedido-meta">
                  {esVendedor ? `${p.items.length} códigos` : `Vendedor: ${p.vendedorNombre}`} · {fmtTime(p.creadoEn)}
                  {p.almaceneroNombre && !esVendedor && ` · Tomado por ${p.almaceneroNombre}`}
                </div>
              </div>
              <span className={`status-pill status-${p.estado}`}>
                {p.estado === "pendiente" && "Pendiente"}
                {p.estado === "tomado" && "En proceso"}
                {p.estado === "finalizado" && "Finalizado"}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
