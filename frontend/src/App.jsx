import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, FileSpreadsheet, FileText, BarChart3, Bell, PackageX, Search } from "lucide-react";
import "./styles.css";
import { api } from "./api.js";
import { exportarReporteCSV, exportarReporteXLSX } from "./reporte.js";
import { pedirPermiso, permisoActual, desbloquearSonido, inicializarServiceWorker, suscribirseAPush } from "./notifications.js";
import LoginScreen from "./components/LoginScreen.jsx";
import TopBar from "./components/TopBar.jsx";
import ListaPedidos from "./components/ListaPedidos.jsx";
import CrearPedido from "./components/CrearPedido.jsx";
import DetallePedido from "./components/DetallePedido.jsx";
import EstadisticasPanel from "./components/EstadisticasPanel.jsx";
import FaltantesPanel from "./components/FaltantesPanel.jsx";
import BuscarPedidos from "./components/BuscarPedidos.jsx";

function MenuExportar({ pedidos, onAbrir }) {
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
      <button className="btn btn-outline btn-sm" style={{ whiteSpace: "nowrap" }}
        onClick={() => { setAbierto(v => !v); if (onAbrir) onAbrir(); }}>
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
  // Historial completo (todos los pedidos, no solo los operativamente
  // relevantes) — se carga aparte y solo bajo demanda, al entrar a
  // Estadísticas, Faltantes o abrir el menú de Exportar. No se mantiene
  // en el poll normal de cada 15s para no cargarlo cada vez más pesado
  // a medida que se acumula el historial.
  const [pedidosCompleto, setPedidosCompleto] = useState(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  // Vendedores y almaceneros: TODOS sus propios pedidos (los del vendedor,
  // o los que tomó el almacenero), también los viejos, que el refresco
  // normal de cada 15s ya no trae. Se piden una vez al entrar y se renuevan
  // cada tanto — son solo los pedidos de esa persona, así que pesa poco;
  // lo reciente igual se sigue actualizando cada 15s.
  const [misHistoricos, setMisHistoricos] = useState([]);
  const [notifPermiso, setNotifPermiso] = useState("default");
  const [mostrarAvisoNotif, setMostrarAvisoNotif] = useState(false);

  useEffect(() => {
    const guardada = localStorage.getItem(SESION_KEY);
    if (guardada) {
      try { setUser(JSON.parse(guardada)); } catch (e) { /* ignorar sesión corrupta */ }
    }
    setCargandoSesion(false);
    const permiso = permisoActual();
    setNotifPermiso(permiso);
    // Se le avisa a cada persona que entra si todavía no activó las
    // notificaciones — una vez por sesión de navegador (si lo cierra o
    // aparece de nuevo al rato, se le recuerda otra vez).
    if (permiso === "default" && !sessionStorage.getItem("notif-aviso-cerrado")) {
      setMostrarAvisoNotif(true);
    }
    inicializarServiceWorker(); // listo de antemano, así la primera notificación no se demora
  }, []);

  function cerrarAvisoNotif() {
    setMostrarAvisoNotif(false);
    sessionStorage.setItem("notif-aviso-cerrado", "1");
  }

  // Ya con sesión iniciada: si el permiso de notificaciones está
  // concedido, (re)confirma la suscripción push en el backend — así,
  // aunque haya vuelto a instalar el Service Worker o cambiado de
  // dispositivo, se mantiene al día. Es seguro llamarlo varias veces.
  useEffect(() => {
    if (user && notifPermiso === "granted") suscribirseAPush(user);
  }, [user, notifPermiso]);

  async function activarNotificaciones() {
    const resultado = await pedirPermiso();
    setNotifPermiso(resultado);
    setMostrarAvisoNotif(false);
    if (resultado === "granted") await suscribirseAPush(user);
  }

  const cargarPedidos = useCallback(async () => {
    try {
      // El vendedor ahora ve TODOS los pedidos (como el almacenero), pero
      // los que no son suyos le llegan "vacíos" de contenido — el backend
      // ya se encarga de no mandar los códigos ni la foto de esos.
      const opciones = user?.rol === "vendedor" ? { viewerId: user.id, ocultarAjenos: true } : {};
      const lista = await api.listarPedidos(opciones);
      setPedidos(lista);
    } catch (e) { /* se reintenta en el próximo poll */ }
    setCargandoPedidos(false);
  }, [user]);

  // Se usa solo al abrir Estadísticas, Faltantes o Exportar — trae el
  // historial completo una vez (no en cada poll de 15s).
  const cargarHistorialCompleto = useCallback(async () => {
    if (!user) return;
    setCargandoHistorial(true);
    try {
      const opciones = user.rol === "vendedor"
        ? { viewerId: user.id, ocultarAjenos: true, completo: true }
        : { completo: true };
      const lista = await api.listarPedidos(opciones);
      setPedidosCompleto(lista);
    } catch (e) { /* se puede reintentar al reabrir la pantalla */ }
    setCargandoHistorial(false);
  }, [user]);

  const cargarMisHistoricos = useCallback(async () => {
    if (!user || (user.rol !== "vendedor" && user.rol !== "almacenero")) return;
    try {
      const opciones = user.rol === "vendedor"
        ? { vendedorId: user.id, viewerId: user.id, ocultarAjenos: true, completo: true }
        : { almaceneroId: user.id, completo: true };
      const lista = await api.listarPedidos(opciones);
      setMisHistoricos(lista);
    } catch (e) { /* se reintenta en la próxima renovación */ }
  }, [user]);

  useEffect(() => {
    if (!user || (user.rol !== "vendedor" && user.rol !== "almacenero")) return;
    cargarMisHistoricos();
    const iv = setInterval(cargarMisHistoricos, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [user, cargarMisHistoricos]);

  useEffect(() => {
    if (!user) return;
    cargarPedidos();
    // 15s en vez de 5s: esta es la consulta que más se repite en toda la
    // app (corre para cada persona con la pantalla abierta) — lo urgente
    // (pedido nuevo, cambio de estado, mensaje) ya llega al instante por
    // notificación push, así que no hace falta revisar tan seguido.
    const iv = setInterval(cargarPedidos, 15000);
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
  // Carga de trabajo del almacén en este momento: cuántos pedidos tiene
  // tomados cada almacenero — se ve en la pantalla principal para saber
  // quién tiene más encima. (Cálculo simple, no necesita useMemo — y no
  // puede usarlo acá: los "if" de arriba ya hicieron return antes de
  // llegar a este punto en algunos renders, así que un hook acá rompería
  // las reglas de React.)
  const mapaAlmaceneros = new Map();
  for (const p of pedidos) {
    if (p.estado === "tomado" && p.almaceneroNombre) {
      mapaAlmaceneros.set(p.almaceneroNombre, (mapaAlmaceneros.get(p.almaceneroNombre) || 0) + 1);
    }
  }
  const cargaAlmaceneros = [...mapaAlmaceneros.entries()].sort((a, b) => b[1] - a[1]);
  // Lista que ve el vendedor/almacenero: sus pedidos históricos + lo reciente (lo
  // reciente, que se refresca cada 15s, pisa a la copia histórica).
  let pedidosParaLista = pedidos;
  if (misHistoricos.length > 0) {
    const mapa = new Map(misHistoricos.map(p => [p.id, p]));
    for (const p of pedidos) mapa.set(p.id, p);
    pedidosParaLista = [...mapa.values()];
  }
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
          {mostrarAvisoNotif && (
            <div className="notif-prompt">
              <div className="notif-prompt-icon"><Bell size={18} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5 }}>Activa las notificaciones</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Así te enteras al instante de pedidos y mensajes nuevos, aunque tengas cerrado el navegador.</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                <button className="btn btn-teal btn-sm" onClick={activarNotificaciones}>Activar</button>
                <button className="btn btn-ghost btn-sm" onClick={cerrarAvisoNotif}>Ahora no</button>
              </div>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div className="page-title">
                {user.rol === "vendedor" ? `Hola, ${user.nombre.split(" ")[0]}`
                  : user.rol === "paqueteria" ? "Pedidos por despachar"
                  : "Pedidos por despachar"}
              </div>
              <div className="page-sub">
                {user.rol === "paqueteria"
                  ? "Confirma cuando la mercadería ya haya sido entregada."
                  : "Todas las listas enviadas — cualquiera puede tomar y despachar un pedido."}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button className="btn btn-outline btn-sm" style={{ whiteSpace: "nowrap" }}
                onClick={() => setVista("buscar")}>
                <Search size={13} /> Buscar pedidos
              </button>
              <button className="btn btn-outline btn-sm" style={{ whiteSpace: "nowrap" }}
                onClick={() => { setVista("estadisticas"); cargarHistorialCompleto(); }}>
                <BarChart3 size={13} /> Estadísticas
              </button>
              {user.rol === "almacenero" && (
                <button className="btn btn-outline btn-sm" style={{ whiteSpace: "nowrap" }}
                  onClick={() => { setVista("faltantes"); cargarHistorialCompleto(); }}>
                  <PackageX size={13} /> Faltantes
                </button>
              )}
              {user.rol === "almacenero" && (
                <MenuExportar pedidos={pedidosCompleto || []} onAbrir={cargarHistorialCompleto} />
              )}
            </div>
          </div>
          {cargaAlmaceneros.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, margin: "10px 0 2px" }}>
              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", fontWeight: 800 }}>
                En almacén ahora:
              </span>
              {cargaAlmaceneros.map(([nombre, cant]) => (
                <span key={nombre} className="name-chip almacenero">{nombre}: {cant} pedido{cant > 1 ? "s" : ""}</span>
              ))}
            </div>
          )}
          <ListaPedidos pedidos={pedidosParaLista} user={user} onOpen={abrirPedido} loading={cargandoPedidos} onPedidoActualizado={cargarPedidos} />
        </div>
      )}

      {vista === "buscar" && (
        <div className="container">
          <button className="btn btn-outline btn-sm" style={{ marginBottom: 16 }} onClick={() => setVista("home")}>
            ← Volver
          </button>
          <BuscarPedidos user={user} onOpen={abrirPedido} />
        </div>
      )}

      {vista === "estadisticas" && (
        <div className="container">
          <button className="btn btn-outline btn-sm" style={{ marginBottom: 16 }} onClick={() => setVista("home")}>
            ← Volver
          </button>
          {cargandoHistorial && !pedidosCompleto ? (
            <div style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>Cargando historial…</div>
          ) : (
            <EstadisticasPanel pedidos={pedidosCompleto || []} />
          )}
        </div>
      )}

      {vista === "faltantes" && (
        <div className="container">
          <button className="btn btn-outline btn-sm" style={{ marginBottom: 16 }} onClick={() => setVista("home")}>
            ← Volver
          </button>
          {cargandoHistorial && !pedidosCompleto ? (
            <div style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>Cargando historial…</div>
          ) : (
            <FaltantesPanel pedidos={pedidosCompleto || []} />
          )}
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
