import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, FileSpreadsheet, FileText, BarChart3 } from "lucide-react";
import "./styles.css";
import { api } from "./api.js";
import { exportarReporteCSV, exportarReporteXLSX } from "./reporte.js";
import LoginScreen from "./components/LoginScreen.jsx";
import TopBar from "./components/TopBar.jsx";
import ListaPedidos from "./components/ListaPedidos.jsx";
import CrearPedido from "./components/CrearPedido.jsx";
import DetallePedido from "./components/DetallePedido.jsx";
import EstadisticasPanel from "./components/EstadisticasPanel.jsx";

function MenuExportar({ pedidos }) {
  const [abierto, setAbierto] = useState(false);
  const [todaLaData, setTodaLaData] = useState(false);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [cliente, setCliente] = useState("");

  const puedeExportar = todaLaData || (fechaDesde && fechaHasta);

  function construirFiltro() {
    return todaLaData
      ? { cliente }
      : { fechaDesde, fechaHasta, cliente };
  }

  function descargar(fn) {
    fn(pedidos, construirFiltro());
    setAbierto(false);
  }

  return (
    <div style={{ position: "relative" }}>
      <button className="btn btn-outline btn-sm" style={{ whiteSpace: "nowrap" }} onClick={() => setAbierto(v => !v)}>
        <FileSpreadsheet size={13} /> Exportar
      </button>
      {abierto && (
        <div className="card" style={{ position: "absolute", right: 0, top: "110%", zIndex: 10, padding: 14, width: 240 }}>
          <div className="field" style={{ marginBottom: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", textTransform: "none", fontSize: 12.5 }}>
              <input type="checkbox" checked={todaLaData} onChange={e => setTodaLaData(e.target.checked)} />
              Exportar toda la data
            </label>
          </div>
          {!todaLaData && (
            <>
              <div className="field" style={{ marginBottom: 8 }}>
                <label>Desde *</label>
                <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 8 }}>
                <label>Hasta *</label>
                <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
              </div>
            </>
          )}
          <div className="field" style={{ marginBottom: 10 }}>
            <label>Cliente (opcional)</label>
            <input type="text" placeholder="Todos" value={cliente} onChange={e => setCliente(e.target.value)} />
          </div>
          {!puedeExportar && (
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
              Elige un rango de fechas, o marca "Exportar toda la data".
            </div>
          )}
          <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "flex-start" }}
            disabled={!puedeExportar} onClick={() => descargar(exportarReporteXLSX)}>
            <FileSpreadsheet size={14} /> Excel (.xlsx)
          </button>
          <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "flex-start" }}
            disabled={!puedeExportar} onClick={() => descargar(exportarReporteCSV)}>
            <FileText size={14} /> CSV
          </button>
        </div>
      )}
    </div>
  );
}

const SESION_KEY = "despacho-sesion";

export default function App() {
  const [user, setUser] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [vista, setVista] = useState("home"); // home | crear | detalle
  const [pedidoActivoId, setPedidoActivoId] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(true);

  useEffect(() => {
    const guardada = localStorage.getItem(SESION_KEY);
    if (guardada) {
      try { setUser(JSON.parse(guardada)); } catch (e) { /* ignorar sesión corrupta */ }
    }
    setCargandoSesion(false);
  }, []);

  const cargarPedidos = useCallback(async () => {
    try {
      const lista = await api.listarPedidos();
      setPedidos(lista);
    } catch (e) { /* se reintenta en el próximo poll */ }
    setCargandoPedidos(false);
  }, []);

  useEffect(() => {
    if (!user || vista !== "home") return;
    cargarPedidos();
    const iv = setInterval(cargarPedidos, 5000);
    return () => clearInterval(iv);
  }, [user, vista, cargarPedidos]);

  function handleLogin(u) {
    setUser(u);
    localStorage.setItem(SESION_KEY, JSON.stringify(u));
  }
  function handleLogout() {
    setUser(null);
    localStorage.removeItem(SESION_KEY);
    setVista("home");
  }

  const [errorCrear, setErrorCrear] = useState("");

  async function crearPedido({ cliente, items, foto, tipo }) {
    setErrorCrear("");
    try {
      const nuevoPedido = await api.crearPedido({
        cliente,
        vendedorId: user.id,
        vendedorNombre: user.nombre,
        items,
        foto,
        tipo
      });
      setPedidoActivoId(nuevoPedido.id);
      setVista("detalle");
    } catch (err) {
      console.error("Error al crear pedido:", err);
      setErrorCrear(err.message || "No se pudo enviar el pedido. Intenta de nuevo.");
    }
  }

  function abrirPedido(id) {
    setPedidoActivoId(id);
    setVista("detalle");
  }

  if (cargandoSesion) {
    return <div className="app-root"><div className="empty-state"><Loader2 className="spin" size={26} /></div></div>;
  }

  if (!user) {
    return <div className="app-root"><LoginScreen onLogin={handleLogin} /></div>;
  }

  return (
    <div className="app-root">
      <TopBar user={user} onLogout={handleLogout} onBack={vista !== "home" ? () => { setVista("home"); cargarPedidos(); } : null} />

      {vista === "home" && (
        <div className="container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div className="page-title">{user.rol === "vendedor" ? `Hola, ${user.nombre.split(" ")[0]}` : "Pedidos por despachar"}</div>
              <div className="page-sub">Todas las listas enviadas — cualquiera puede tomar y despachar un pedido.</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-outline btn-sm" style={{ whiteSpace: "nowrap" }} onClick={() => setVista("estadisticas")}>
                <BarChart3 size={13} /> Estadísticas
              </button>
              {user.rol === "almacenero" && <MenuExportar pedidos={pedidos} />}
            </div>
          </div>
          <ListaPedidos pedidos={pedidos} user={user} onOpen={abrirPedido} loading={cargandoPedidos} />
        </div>
      )}

      {vista === "estadisticas" && (
        <div className="container">
          <button className="btn btn-outline btn-sm" style={{ marginBottom: 16 }} onClick={() => setVista("home")}>
            ← Volver
          </button>
          <EstadisticasPanel pedidos={pedidos} />
        </div>
      )}

      {vista === "crear" && (
        <CrearPedido onCreado={crearPedido} onCancelar={() => setVista("home")} errorEnvio={errorCrear} />
      )}

      {vista === "detalle" && pedidoActivoId && (
        <DetallePedido pedidoId={pedidoActivoId} user={user} onVolver={() => { setVista("home"); cargarPedidos(); }} />
      )}

      {vista === "home" && user.rol === "vendedor" && (
        <div className="fab">
          <button className="btn btn-primary btn-block" onClick={() => setVista("crear")}>
            <Plus size={16} /> Nuevo pedido
          </button>
        </div>
      )}
    </div>
  );
}
