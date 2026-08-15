import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Plus, FileSpreadsheet, FileText, BarChart3 } from "lucide-react";
import "./styles.css";
import { api } from "./api.js";
import { exportarReporteCSV, exportarReporteXLSX } from "./reporte.js";
import { notificar, pedirPermiso, permisoActual, desbloquearSonido, inicializarServiceWorker } from "./notifications.js";
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
  const [notifPermiso, setNotifPermiso] = useState("default");
  const pedidosAnterioresRef = useRef(new Map()); // id -> pedido, snapshot del poll anterior
  const primerCargaRef = useRef(true); // no notificar de golpe todo lo que ya existía al entrar

  useEffect(() => {
    const guardada = localStorage.getItem(SESION_KEY);
    if (guardada) {
      try { setUser(JSON.parse(guardada)); } catch (e) { /* ignorar sesión corrupta */ }
    }
    setCargandoSesion(false);
    setNotifPermiso(permisoActual());
    inicializarServiceWorker(); // listo de antemano, así la primera notificación no se demora
  }, []);

  async function activarNotificaciones() {
    const resultado = await pedirPermiso();
    setNotifPermiso(resultado);
  }

  const cargarPedidos = useCallback(async () => {
    try {
      // Un vendedor solo debe recibir SUS propios pedidos — se filtra ya
      // en el backend, no solo se esconde en la pantalla, para que ni
      // siquiera le lleguen al navegador los pedidos de otros vendedores.
      const vendedorId = user?.rol === "vendedor" ? user.id : undefined;
      const lista = await api.listarPedidos(vendedorId);

      // Comparamos contra el snapshot anterior para avisar solo de lo que
      // cambió recién (pedido nuevo, mensaje nuevo, cambio de estado) —
      // nunca de todo lo que ya existía la primera vez que se carga la lista.
      if (user && !primerCargaRef.current) {
        const anteriores = pedidosAnterioresRef.current;
        for (const p of lista) {
          const antes = anteriores.get(p.id);

          // Almacén: pedido nuevo, o un pedido que "volvió" a pendiente
          // (alguien lo liberó, o el vendedor lo reenvió para separar).
          if (user.rol === "almacenero" && p.estado === "pendiente" && !p.vistoPorAlmacen) {
            const esNuevo = !antes;
            const volvioAPendiente = antes && antes.estado !== "pendiente";
            if (esNuevo || volvioAPendiente) {
              notificar("Nuevo pedido", { body: `${p.cliente} · ${p.items.length} código(s)`, tag: `pedido-${p.id}-${p.tomadoEn || p.creadoEn}` });
            }
          }

          // Vendedor: su propio pedido cambió de estado (lo tomaron, lo
          // finalizaron/confirmaron, lo cancelaron, o volvió a pendiente).
          if (user.rol === "vendedor" && antes && antes.estado !== p.estado && p.vendedorId === user.id) {
            const textos = {
              tomado: "Tu pedido está en proceso.",
              finalizado: p.tipo === "confirmar" ? "Tu pedido fue confirmado." : `Tu pedido fue finalizado · ${p.cajas || 0} caja(s).`,
              cancelado: "Tu pedido fue cancelado.",
              pendiente: "Tu pedido volvió a quedar pendiente."
            };
            notificar(`Pedido ${p.id}`, { body: textos[p.estado] || `${p.cliente} cambió de estado.`, tag: `estado-${p.id}-${p.estado}` });
          }

          // Mensaje de chat nuevo, de la otra persona (no de uno mismo).
          if (p.ultimoMensajeAutorRol && p.ultimoMensajeAutorRol !== user.rol) {
            const antesVistoVendedor = antes ? antes.chatVistoVendedor : true;
            const antesVistoAlmacen = antes ? antes.chatVistoAlmacen : true;
            const yaEraNoVisto = user.rol === "vendedor" ? !antesVistoVendedor : !antesVistoAlmacen;
            const ahoraNoVisto = user.rol === "vendedor" ? !p.chatVistoVendedor : !p.chatVistoAlmacen;
            const meAplica = user.rol === "vendedor" ? p.vendedorId === user.id : p.almaceneroId === user.id;
            if (meAplica && ahoraNoVisto && (!antes || !yaEraNoVisto)) {
              notificar("Nuevo mensaje", { body: `Pedido ${p.id} · ${p.cliente}`, tag: `chat-${p.id}-${p.ultimoMensajeEn}` });
            }
          }
        }
      }

      pedidosAnterioresRef.current = new Map(lista.map(p => [p.id, p]));
      primerCargaRef.current = false;
      setPedidos(lista);
    } catch (e) { /* se reintenta en el próximo poll */ }
    setCargandoPedidos(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    cargarPedidos();
    const iv = setInterval(cargarPedidos, 5000);
    return () => clearInterval(iv);
  }, [user, cargarPedidos]);

  function handleLogin(u) {
    setUser(u);
    localStorage.setItem(SESION_KEY, JSON.stringify(u));
    desbloquearSonido(); // el login es el primer "click" real, aprovechamos para habilitar el audio
  }
  function handleLogout() {
    setUser(null);
    localStorage.removeItem(SESION_KEY);
    setVista("home");
  }

  const [errorCrear, setErrorCrear] = useState("");

  async function crearPedido({ cliente, items, fotos, tipo }) {
    setErrorCrear("");
    try {
      const nuevoPedido = await api.crearPedido({
        cliente,
        vendedorId: user.id,
        vendedorNombre: user.nombre,
        items,
        fotos,
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

  const notifPedidosCount = user.rol === "almacenero"
    ? pedidos.filter(p => p.estado === "pendiente" && !p.vistoPorAlmacen).length
    : 0;
  const notifChatCount = pedidos.filter(p => user.rol === "vendedor"
    ? (p.vendedorId === user.id && !p.chatVistoVendedor)
    : (p.almaceneroId === user.id && !p.chatVistoAlmacen)
  ).length;

  return (
    <div className="app-root">
      <TopBar
        user={user} onLogout={handleLogout}
        onBack={vista !== "home" ? () => { setVista("home"); cargarPedidos(); } : null}
        notifPermiso={notifPermiso} onActivarNotificaciones={activarNotificaciones}
        notifCount={notifPedidosCount + notifChatCount}
      />

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
          <ListaPedidos pedidos={pedidos} user={user} onOpen={abrirPedido} loading={cargandoPedidos} onPedidoActualizado={cargarPedidos} />
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
