import { ClipboardList, Loader2 } from "lucide-react";
import { fmtTime } from "../helpers.js";

export default function ListaPedidos({ pedidos, user, onOpen, loading }) {
  const esVendedor = user.rol === "vendedor";

  if (loading) {
    return <div className="empty-state"><Loader2 className="spin" size={26} /></div>;
  }
  if (pedidos.length === 0) {
    return (
      <div className="empty-state">
        <ClipboardList size={30} style={{ opacity: 0.4, marginBottom: 10 }} />
        <div>{esVendedor ? "Aún no creaste ningún pedido." : "No hay pedidos por ahora."}</div>
      </div>
    );
  }

  return (
    <div>
      {pedidos.map(p => {
        const notifPendiente = esVendedor && p.estado === "finalizado" && !p.vistoPorVendedor;
        return (
          <div className="pedido-row" key={p.id} onClick={() => onOpen(p.id)}>
            {notifPendiente && <span className="notif-dot" />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pedido-id">{p.id}</div>
              <div className="pedido-cliente">{p.cliente}</div>
              <div className="pedido-meta">
                {esVendedor ? `${p.items.length} códigos` : `Vendedor: ${p.vendedorNombre}`} · {fmtTime(p.creadoEn)}
              </div>
            </div>
            <span className={`status-pill status-${p.estado}`}>
              {p.estado === "enviado" ? "En proceso" : "Finalizado"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
