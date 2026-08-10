import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, FileSpreadsheet } from "lucide-react";
import "./styles.css";
import { api } from "./api.js";
import { exportarReporteCSV } from "./reporte.js";
import LoginScreen from "./components/LoginScreen.jsx";
import TopBar from "./components/TopBar.jsx";
import ListaPedidos from "./components/ListaPedidos.jsx";
import CrearPedido from "./components/CrearPedido.jsx";
import DetallePedido from "./components/DetallePedido.jsx";

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
      const vendedorId = user?.rol === "vendedor" ? user.id : undefined;
      const lista = await api.listarPedidos(vendedorId);
      setPedidos(lista);
    } catch (e) { /* se reintenta en el próximo poll */ }
    setCargandoPedidos(false);
  }, [user]);

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

  async function crearPedido({ cliente, items }) {
    setErrorCrear("");
    try {
      const nuevoPedido = await api.crearPedido({
        cliente,
        vendedorId: user.id,
        vendedorNombre: user.nombre,
        items
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
              <div className="page-sub">
                {user.rol === "vendedor" ? "Tus pedidos enviados al almacén." : "Toma, marca y finaliza los pedidos de los vendedores."}
              </div>
            </div>
            {user.rol === "almacenero" && (
              <button className="btn btn-outline btn-sm" style={{ whiteSpace: "nowrap" }}
                onClick={() => exportarReporteCSV(pedidos)}>
                <FileSpreadsheet size={13} /> Exportar
              </button>
            )}
          </div>
          <ListaPedidos pedidos={pedidos} user={user} onOpen={abrirPedido} loading={cargandoPedidos} />
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
