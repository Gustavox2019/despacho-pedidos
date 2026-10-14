import { useState } from "react";
import { Search, Loader2, ClipboardList, Lock } from "lucide-react";
import { fmtTime } from "../helpers.js";
import { api } from "../api.js";

const FILTROS_VACIOS = {
  codigo: "", cliente: "", idPedido: "", vendedor: "", almacenero: "",
  fechaDesde: "", fechaHasta: ""
};

const ESTADOS = [
  { valor: "pendiente", etiqueta: "Pendiente" },
  { valor: "tomado", etiqueta: "En proceso" },
  { valor: "finalizado", etiqueta: "Finalizado" },
  { valor: "cancelado", etiqueta: "Cancelado" },
  { valor: "despachado", etiqueta: "Despachado" }
];

function EtiquetaEstado({ estado }) {
  const e = ESTADOS.find(e => e.valor === estado);
  return <>{e ? e.etiqueta : estado}</>;
}

// Apartado específico para buscar en TODO el historial (no solo lo
// reciente) — a diferencia de la pestaña "Todos", esto SÍ llega hasta
// pedidos de meses atrás, porque la búsqueda se hace directo en la base
// de datos con los filtros puestos, en vez de traer todo el historial al
// navegador primero (eso gastaría de más el ancho de banda de Supabase).
export default function BuscarPedidos({ user, onOpen }) {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [estadosElegidos, setEstadosElegidos] = useState([]);
  const [resultados, setResultados] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");

  function actualizar(campo, valor) {
    setFiltros(f => ({ ...f, [campo]: valor }));
  }

  function toggleEstado(valor) {
    setEstadosElegidos(prev => prev.includes(valor) ? prev.filter(v => v !== valor) : [...prev, valor]);
  }

  const hayAlgunFiltro = Object.values(filtros).some(v => v.trim && v.trim());

  async function buscar(e) {
    if (e) e.preventDefault();
    if (!hayAlgunFiltro) {
      setError("Pon al menos un filtro (código, cliente, pedido, vendedor, almacenero o fecha) para buscar.");
      return;
    }
    setError("");
    setBuscando(true);
    try {
      const opciones = {
        ...filtros,
        estados: estadosElegidos,
        ...(user.rol === "vendedor" ? { viewerId: user.id, ocultarAjenos: true } : {})
      };
      const data = await api.buscarPedidos(opciones);
      setResultados(data);
    } catch (err) {
      setError(err.message || "No se pudo buscar.");
      setResultados(null);
    }
    setBuscando(false);
  }

  function limpiar() {
    setFiltros(FILTROS_VACIOS);
    setEstadosElegidos([]);
    setResultados(null);
    setError("");
  }

  return (
    <div>
      <div className="page-title">Buscar pedidos</div>
      <div className="page-sub">
        Busca en todo el historial, no solo en lo reciente — aplica los filtros que necesites (no hace falta llenarlos todos) y presiona Buscar.
      </div>

      <form onSubmit={buscar} className="card" style={{ padding: 14, marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="field">
          <label>Código</label>
          <input type="text" placeholder="Buscar por código…" value={filtros.codigo}
            onChange={e => actualizar("codigo", e.target.value)} />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Cliente</label>
            <input type="text" placeholder="Todos" value={filtros.cliente}
              onChange={e => actualizar("cliente", e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>ID pedido</label>
            <input type="text" placeholder="PED-0001" value={filtros.idPedido}
              onChange={e => actualizar("idPedido", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Vendedor</label>
            <input type="text" placeholder="Todos" value={filtros.vendedor}
              onChange={e => actualizar("vendedor", e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Almacenero</label>
            <input type="text" placeholder="Todos" value={filtros.almacenero}
              onChange={e => actualizar("almacenero", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Desde</label>
            <input type="date" value={filtros.fechaDesde} onChange={e => actualizar("fechaDesde", e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Hasta</label>
            <input type="date" value={filtros.fechaHasta} onChange={e => actualizar("fechaHasta", e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Estado (opcional, puedes elegir varios)</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
            {ESTADOS.map(e => (
              <label key={e.valor} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, textTransform: "none", cursor: "pointer" }}>
                <input type="checkbox" checked={estadosElegidos.includes(e.valor)} onChange={() => toggleEstado(e.valor)} />
                {e.etiqueta}
              </label>
            ))}
          </div>
        </div>

        {error && <div style={{ color: "var(--danger, #c0392b)", fontSize: 12.5 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="btn btn-primary btn-sm" disabled={buscando}>
            {buscando ? <Loader2 className="spin" size={14} /> : <Search size={14} />} Buscar
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={limpiar}>Limpiar</button>
        </div>
      </form>

      <div style={{ marginTop: 16 }}>
        {buscando ? (
          <div className="empty-state"><Loader2 className="spin" size={26} /></div>
        ) : resultados === null ? null : resultados.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={30} style={{ opacity: 0.4, marginBottom: 10 }} />
            <div>Ningún pedido coincide con esos filtros.</div>
          </div>
        ) : (
          <>
            <div className="helper-text" style={{ margin: "4px 0 10px" }}>
              {resultados.length} pedido(s) encontrado(s){resultados.length === 300 ? " (se muestran los primeros 300 — ajusta los filtros para acotar más)" : ""}:
            </div>
            {resultados.map(p => {
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
              return (
                <div className="pedido-row" key={p.id} onClick={() => onOpen(p.id)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="pedido-id">{p.id}</div>
                    <div className="pedido-cliente">{p.cliente}</div>
                    <div className="pedido-meta">
                      {(p.items || []).length} códigos · {fmtTime(p.creadoEn)}
                      {p.estado === "finalizado" && p.finalizadoEn && ` · Finalizado ${fmtTime(p.finalizadoEn)}`}
                      {p.estado === "despachado" && p.despachadoEn && ` · Despachado ${fmtTime(p.despachadoEn)}`}
                      {p.estado === "cancelado" && p.canceladoEn && ` · Cancelado ${fmtTime(p.canceladoEn)}`}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      <span className="name-chip vendedor">V: {p.vendedorNombre}</span>
                      {p.almaceneroNombre && <span className="name-chip almacenero">A: {p.almaceneroNombre}</span>}
                      {p.despachadoPorNombre && <span className="name-chip paqueteria">P: {p.despachadoPorNombre}</span>}
                    </div>
                  </div>
                  <span className={`status-pill status-${p.estado}`}><EtiquetaEstado estado={p.estado} /></span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
