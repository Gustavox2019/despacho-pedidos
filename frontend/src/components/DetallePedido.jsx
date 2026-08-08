import { useState, useEffect, useCallback } from "react";
import {
  Loader2, CheckCheck, ClipboardList, CheckCircle2, XCircle,
  Boxes, Download, MessageSquare, ChevronLeft
} from "lucide-react";
import { fmtTime } from "../helpers.js";
import { api } from "../api.js";
import { descargarEtiquetas } from "../etiquetas.js";
import ChatPanel from "./ChatPanel.jsx";

export default function DetallePedido({ pedidoId, user, onVolver }) {
  const [pedido, setPedido] = useState(null);
  const [cajasInput, setCajasInput] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const p = await api.obtenerPedido(pedidoId);
      setPedido(p);
      if (p.cajas) setCajasInput(String(p.cajas));
    } catch (e) { /* se reintenta en el próximo poll */ }
  }, [pedidoId]);

  useEffect(() => {
    cargar();
    const iv = setInterval(cargar, 4000);
    return () => clearInterval(iv);
  }, [cargar]);

  useEffect(() => {
    (async () => {
      if (pedido && user.rol === "vendedor" && pedido.estado === "finalizado" && !pedido.vistoPorVendedor) {
        const actualizado = await api.actualizarPedido(pedidoId, { vistoPorVendedor: true });
        setPedido(actualizado);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.estado, pedido?.vistoPorVendedor]);

  async function guardarPedido(patch) {
    setGuardando(true);
    try {
      const actualizado = await api.actualizarPedido(pedidoId, patch);
      setPedido(actualizado);
    } finally {
      setGuardando(false);
    }
  }

  function updateItemCheck(itemId, patch) {
    const nuevosItems = pedido.items.map(it => it.id === itemId ? { ...it, ...patch } : it);
    guardarPedido({ items: nuevosItems });
  }

  if (!pedido) {
    return <div className="container"><div className="empty-state"><Loader2 className="spin" size={26} /></div></div>;
  }

  const esAlmacenero = user.rol === "almacenero";
  const todosMarcados = pedido.items.every(it => it.check === "ok" || it.check === "no");
  const cajasValidas = Number(cajasInput) > 0;
  const puedeFinalizar = todosMarcados && cajasValidas && pedido.estado === "enviado";

  async function finalizar() {
    await guardarPedido({ estado: "finalizado", cajas: Number(cajasInput), finalizadoEn: Date.now(), vistoPorVendedor: false, almaceneroNombre: user.nombre });
  }

  return (
    <div className="container">
      <div className="pedido-id" style={{ fontSize: 13 }}>{pedido.id}</div>
      <div className="page-title">{pedido.cliente}</div>
      <div className="page-sub">
        Vendedor: {pedido.vendedorNombre} · {fmtTime(pedido.creadoEn)}{" "}
        <span className={`status-pill status-${pedido.estado}`} style={{ marginLeft: 6 }}>
          {pedido.estado === "enviado" ? "En proceso" : "Finalizado"}
        </span>
      </div>

      {pedido.estado === "finalizado" && user.rol === "vendedor" && (
        <div className="banner banner-success">
          <CheckCheck size={16} />
          <div>
            Pedido finalizado por {pedido.almaceneroNombre || "almacén"} · {pedido.cajas} caja(s) preparadas.
          </div>
        </div>
      )}

      <div className="section-label"><ClipboardList size={13} /> Checklist</div>
      <table className="item-table">
        <tbody>
          {pedido.items.map(it => (
            <tr className="item-row" key={it.id}>
              <td style={{ width: 34, fontFamily: "var(--mono)", fontSize: 13, color: "var(--muted)" }}>{it.cantidad}</td>
              <td>
                <div style={{ fontFamily: "var(--mono)", fontSize: 13 }}>{it.codigo}</div>
                {it.piso && <div style={{ fontSize: 11, color: "var(--muted)" }}>Piso: {it.piso}</div>}
              </td>
              <td style={{ width: esAlmacenero ? 190 : 0 }}>
                {esAlmacenero && pedido.estado === "enviado" ? (
                  <div className="check-controls">
                    <button className={`chk-btn ${it.check === "ok" ? "active-ok" : ""}`}
                      onClick={() => updateItemCheck(it.id, { check: it.check === "ok" ? null : "ok" })}>
                      <CheckCircle2 size={16} />
                    </button>
                    <button className={`chk-btn ${it.check === "no" ? "active-no" : ""}`}
                      onClick={() => updateItemCheck(it.id, { check: it.check === "no" ? null : "no" })}>
                      <XCircle size={16} />
                    </button>
                    <input type="text" className="txt-mini" placeholder="detalle" value={it.texto || ""}
                      onChange={e => updateItemCheck(it.id, { texto: e.target.value })} />
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {it.check === "ok" && <CheckCircle2 size={16} color="var(--green)" />}
                    {it.check === "no" && <XCircle size={16} color="var(--red)" />}
                    {it.texto && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{it.texto}</span>}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {esAlmacenero && pedido.estado === "enviado" && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="field" style={{ marginBottom: 10 }}>
            <label><Boxes size={12} style={{ verticalAlign: -2 }} /> Cantidad de cajas del pedido</label>
            <input type="number" min="1" value={cajasInput} onChange={e => setCajasInput(e.target.value)} />
          </div>
          {!todosMarcados && (
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>
              Marca check o equis en todos los códigos para poder finalizar.
            </div>
          )}
          <button className="btn btn-primary btn-block" disabled={!puedeFinalizar || guardando} onClick={finalizar}>
            {guardando ? <Loader2 className="spin" size={15} /> : "Finalizar pedido"}
          </button>
        </div>
      )}

      {pedido.estado === "finalizado" && (
        <div className="card" style={{ marginTop: 18, textAlign: "center" }}>
          <div className="cajas-count-badge" style={{ marginBottom: 12 }}>
            <Boxes size={13} /> {pedido.cajas} caja(s) preparadas
          </div>
          <button className="btn btn-teal btn-block" onClick={() => descargarEtiquetas(pedido)}>
            <Download size={15} /> Descargar etiquetas para las cajas
          </button>
        </div>
      )}

      <div className="section-label"><MessageSquare size={13} /> Chat del pedido</div>
      <ChatPanel pedidoId={pedido.id} user={user} />

      <div style={{ marginTop: 22 }}>
        <button className="btn btn-outline" onClick={onVolver}><ChevronLeft size={14} /> Volver</button>
      </div>
    </div>
  );
}
