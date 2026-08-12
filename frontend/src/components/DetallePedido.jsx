import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2, CheckCheck, ClipboardList, CheckCircle2, XCircle,
  Boxes, Download, MessageSquare, ChevronLeft, PackageCheck, Plus,
  Image as ImageIcon, MessageCircle, Layers, BadgeCheck
} from "lucide-react";
import { fmtTime, uid, calcularProgreso } from "../helpers.js";
import { api } from "../api.js";
import { descargarEtiquetas } from "../etiquetas.js";
import ChatPanel from "./ChatPanel.jsx";

// Número de WhatsApp de soporte al que se reporta un problema con un
// pedido. Configúralo con VITE_WHATSAPP_SOPORTE en el .env del frontend
// (formato internacional sin "+", ej. 51987654321).
const WHATSAPP_SOPORTE = import.meta.env.VITE_WHATSAPP_SOPORTE || "";

export default function DetallePedido({ pedidoId, user, onVolver }) {
  const [pedido, setPedido] = useState(null);
  const [cajasInput, setCajasInput] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [tomando, setTomando] = useState(false);
  const [nuevaCantidad, setNuevaCantidad] = useState(1);
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [agregando, setAgregando] = useState(false);
  const pedidoRef = useRef(null); // última versión conocida, para no pisar ediciones locales con el poll

  const cargar = useCallback(async () => {
    try {
      const p = await api.obtenerPedido(pedidoId);
      pedidoRef.current = p;
      setPedido(p);
      if (p.cajas) setCajasInput(String(p.cajas));
    } catch (e) { /* se reintenta en el próximo poll */ }
  }, [pedidoId]);

  useEffect(() => {
    cargar();
    const iv = setInterval(cargar, 6000);
    return () => clearInterval(iv);
  }, [cargar]);

  useEffect(() => {
    (async () => {
      if (pedido && user.rol === "vendedor" && pedido.estado === "finalizado" && !pedido.vistoPorVendedor) {
        const actualizado = await api.actualizarPedido(pedidoId, { vistoPorVendedor: true });
        pedidoRef.current = actualizado;
        setPedido(actualizado);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.estado, pedido?.vistoPorVendedor]);

  // Envía el cambio en segundo plano, sin bloquear la interacción del usuario.
  function guardarEnSegundoPlano(patch) {
    api.actualizarPedido(pedidoId, patch)
      .then(actualizado => { pedidoRef.current = actualizado; })
      .catch(err => console.error("No se pudo guardar:", err));
  }

  function updateItemCheck(itemId, patch) {
    // Actualización optimista: se ve al instante, se guarda de fondo.
    const nuevosItems = pedido.items.map(it => it.id === itemId ? { ...it, ...patch } : it);
    const actualizadoLocal = { ...pedido, items: nuevosItems };
    setPedido(actualizadoLocal);
    guardarEnSegundoPlano({ items: nuevosItems });
  }

  async function agregarProducto() {
    if (!nuevoCodigo.trim()) return;
    setAgregando(true);
    try {
      const nuevoItem = { id: uid("it"), cantidad: Number(nuevaCantidad) || 1, codigo: nuevoCodigo.trim(), piso: "", check: null, texto: "" };
      const nuevosItems = [...pedido.items, nuevoItem];
      const actualizado = await api.actualizarPedido(pedidoId, { items: nuevosItems });
      pedidoRef.current = actualizado;
      setPedido(actualizado);
      setNuevoCodigo("");
      setNuevaCantidad(1);
    } finally {
      setAgregando(false);
    }
  }

  async function tomarPedido(modoAtencion) {
    setTomando(true);
    try {
      const actualizado = await api.actualizarPedido(pedidoId, {
        estado: "tomado", almaceneroId: user.id, almaceneroNombre: user.nombre, tomadoEn: Date.now(), modoAtencion
      });
      pedidoRef.current = actualizado;
      setPedido(actualizado);
    } finally {
      setTomando(false);
    }
  }

  async function finalizar() {
    setGuardando(true);
    try {
      const actualizado = await api.actualizarPedido(pedidoId, {
        estado: "finalizado", cajas: Number(cajasInput), finalizadoEn: Date.now(), vistoPorVendedor: false
      });
      pedidoRef.current = actualizado;
      setPedido(actualizado);
    } finally {
      setGuardando(false);
    }
  }

  if (!pedido) {
    return <div className="container"><div className="empty-state"><Loader2 className="spin" size={26} /></div></div>;
  }

  const esVendedor = user.rol === "vendedor";
  const esPedidoTomadoPorMi = pedido.almaceneroId === user.id;
  const esModoConfirmar = pedido.modoAtencion === "confirmar";
  // Cualquiera (vendedor o almacenero) puede tomar y preparar un pedido —
  // ya no está restringido al rol almacenero.
  const puedeMarcar = pedido.estado === "tomado" && esPedidoTomadoPorMi;
  const vendedorPuedeAgregar = esVendedor && pedido.estado !== "finalizado";
  const todosMarcados = pedido.items.every(it => it.check === "ok" || it.check === "no");
  const cajasValidas = Number(cajasInput) > 0;
  // En modo "confirmar" no se exige marcar cada línea, solo la cantidad de cajas.
  const puedeFinalizar = puedeMarcar && cajasValidas && (esModoConfirmar || todosMarcados);

  const mensajeWhatsapp = encodeURIComponent(`Tengo un problema con el pedido ${pedido.id}`);
  const linkWhatsapp = WHATSAPP_SOPORTE ? `https://wa.me/${WHATSAPP_SOPORTE}?text=${mensajeWhatsapp}` : null;

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <div className="pedido-id" style={{ fontSize: 13 }}>{pedido.id}</div>
          <div className="page-title">{pedido.cliente}</div>
        </div>
        <a
          className="btn btn-outline btn-sm"
          style={{ whiteSpace: "nowrap", color: "var(--green)", borderColor: "var(--green-dim)" }}
          href={linkWhatsapp || undefined}
          target="_blank" rel="noopener noreferrer"
          title={linkWhatsapp ? "Reportar un problema con este pedido por WhatsApp" : "Falta configurar VITE_WHATSAPP_SOPORTE"}
          onClick={e => { if (!linkWhatsapp) e.preventDefault(); }}
          aria-disabled={!linkWhatsapp}
        >
          <MessageCircle size={13} /> WhatsApp
        </a>
      </div>
      <div className="page-sub">
        Vendedor: {pedido.vendedorNombre} · {fmtTime(pedido.creadoEn)}{" "}
        <span className={`status-pill status-${pedido.estado}`} style={{ marginLeft: 6 }}>
          {pedido.estado === "pendiente" && "Pendiente"}
          {pedido.estado === "tomado" && "En proceso"}
          {pedido.estado === "finalizado" && "Finalizado"}
        </span>
      </div>

      {pedido.estado !== "pendiente" && (() => {
        const pct = calcularProgreso(pedido);
        const marcados = pedido.items.filter(it => it.check === "ok" || it.check === "no").length;
        return (
          <div style={{ marginBottom: 16 }}>
            <div className="progreso-wrap" style={{ marginTop: 0 }}>
              <div className="progreso-track">
                <div className={`progreso-fill ${pct >= 100 ? "completo" : ""}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="progreso-label">{pct}%</div>
            </div>
            {pedido.estado === "tomado" && pedido.modoAtencion !== "confirmar" && (
              <div className="helper-text" style={{ marginTop: 4, textAlign: "left" }}>
                {marcados} de {pedido.items.length} código(s) revisados
              </div>
            )}
          </div>
        );
      })()}

      {(pedido.fotoOriginal || pedido.tieneFoto) && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="section-label" style={{ marginTop: 0 }}><ImageIcon size={13} /> Foto original de la lista</div>
          {pedido.fotoOriginal ? (
            <img src={pedido.fotoOriginal} alt="Foto original del pedido" className="upload-preview" style={{ marginBottom: 0 }} />
          ) : (
            <div className="helper-text">Cargando foto…</div>
          )}
        </div>
      )}

      {pedido.estado !== "pendiente" && pedido.almaceneroNombre && (
        <div className="banner banner-warn" style={{ background: "rgba(63,198,193,0.08)", borderColor: "var(--teal-dim)", color: "var(--teal)" }}>
          <PackageCheck size={16} />
          <div>
            Tomado por {pedido.almaceneroNombre}{pedido.tomadoEn ? ` · ${fmtTime(pedido.tomadoEn)}` : ""}
            {pedido.modoAtencion && <> · <strong>{pedido.modoAtencion === "separar" ? "Separando" : "Confirmando"}</strong></>}
          </div>
        </div>
      )}

      {pedido.estado === "finalizado" && user.rol === "vendedor" && (
        <div className="banner banner-success">
          <CheckCheck size={16} />
          <div>Pedido finalizado por {pedido.almaceneroNombre || "almacén"} · {pedido.cajas} caja(s) preparadas.</div>
        </div>
      )}

      {pedido.estado === "pendiente" && (
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
            Nadie ha tomado este pedido todavía. ¿Cómo lo vas a atender?
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={tomando} onClick={() => tomarPedido("separar")}>
              {tomando ? <Loader2 className="spin" size={15} /> : (<><Layers size={14} /> Separar</>)}
            </button>
            <button className="btn btn-teal" style={{ flex: 1 }} disabled={tomando} onClick={() => tomarPedido("confirmar")}>
              {tomando ? <Loader2 className="spin" size={15} /> : (<><BadgeCheck size={14} /> Confirmar</>)}
            </button>
          </div>
          <div className="helper-text" style={{ marginTop: 10 }}>
            "Separar" abre el checklist para armar cajas · "Confirmar" solo valida el pedido rápidamente.
          </div>
        </div>
      )}

      {pedido.estado === "tomado" && !esPedidoTomadoPorMi && (
        <div className="banner banner-warn"><ClipboardList size={16} /> Este pedido ya lo está {pedido.modoAtencion === "confirmar" ? "confirmando" : "preparando"} {pedido.almaceneroNombre}.</div>
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
              <td style={{ width: puedeMarcar && !esModoConfirmar ? 190 : 0 }}>
                {puedeMarcar && !esModoConfirmar ? (
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

      {vendedorPuedeAgregar && (
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", fontWeight: 800, marginBottom: 10 }}>
            Agregar producto a este pedido
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="number" min="1" className="qty-input" style={{ width: 56 }} value={nuevaCantidad}
              onChange={e => setNuevaCantidad(e.target.value)} />
            <input type="text" className="code-chip" placeholder="Código de producto" value={nuevoCodigo}
              onChange={e => setNuevoCodigo(e.target.value)}
              onKeyDown={e => e.key === "Enter" && agregarProducto()} />
            <button className="icon-btn" disabled={!nuevoCodigo.trim() || agregando} onClick={agregarProducto}>
              {agregando ? <Loader2 className="spin" size={15} /> : <Plus size={15} />}
            </button>
          </div>
        </div>
      )}

      {puedeMarcar && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="field" style={{ marginBottom: 10 }}>
            <label><Boxes size={12} style={{ verticalAlign: -2 }} /> Cantidad de cajas del pedido</label>
            <input type="number" min="1" value={cajasInput} onChange={e => setCajasInput(e.target.value)} />
          </div>
          {!esModoConfirmar && !todosMarcados && (
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>
              Marca check o equis en todos los códigos para poder finalizar.
            </div>
          )}
          <button className="btn btn-primary btn-block" disabled={!puedeFinalizar || guardando} onClick={finalizar}>
            {guardando ? <Loader2 className="spin" size={15} /> : (esModoConfirmar ? "Confirmar pedido" : "Finalizar pedido")}
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
