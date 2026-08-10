import { useEffect, useRef, useState } from "react";
import { Package, User, Warehouse, Loader2, AlertTriangle } from "lucide-react";
import { api } from "../api.js";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function LoginScreen({ onLogin }) {
  const botonRef = useRef(null);
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState("");
  const [perfilPendiente, setPerfilPendiente] = useState(null); // cuenta nueva de Google, falta elegir rol
  const [rolElegido, setRolElegido] = useState(null);
  const [guardandoRol, setGuardandoRol] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;

    let intentos = 0;
    const intervalo = setInterval(() => {
      intentos++;
      if (window.google?.accounts?.id) {
        clearInterval(intervalo);
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: manejarRespuestaGoogle
        });
        if (botonRef.current) {
          window.google.accounts.id.renderButton(botonRef.current, {
            theme: "outline", size: "large", width: 320, text: "continue_with"
          });
        }
      } else if (intentos > 40) { // ~10 segundos
        clearInterval(intervalo);
        setError("No se pudo cargar el inicio de sesión de Google. Revisa tu conexión y recarga la página.");
      }
    }, 250);

    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function manejarRespuestaGoogle(response) {
    setError("");
    setVerificando(true);
    try {
      const perfil = await api.loginGoogle(response.credential);
      if (perfil.rol) {
        onLogin(perfil);
      } else {
        setPerfilPendiente(perfil); // necesita elegir vendedor/almacenero (primera vez)
      }
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión con Google.");
    } finally {
      setVerificando(false);
    }
  }

  async function confirmarRol() {
    if (!rolElegido || !perfilPendiente) return;
    setGuardandoRol(true);
    try {
      const usuario = await api.guardarRol({ id: perfilPendiente.id, nombre: perfilPendiente.nombre, correo: perfilPendiente.correo, rol: rolElegido });
      onLogin(usuario);
    } catch (err) {
      setError(err.message || "No se pudo guardar tu rol.");
    } finally {
      setGuardandoRol(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div className="brand-mark" style={{ margin: "0 auto 10px", width: 44, height: 44 }}>
            <Package size={22} />
          </div>
          <div className="brand-text" style={{ fontSize: 16 }}>Despacho</div>
          <div className="brand-sub">Pedidos · Vendedores &amp; Almacén</div>
        </div>

        {!CLIENT_ID && (
          <div className="banner banner-warn"><AlertTriangle size={16} /> Falta configurar VITE_GOOGLE_CLIENT_ID.</div>
        )}
        {error && (
          <div className="banner banner-warn"><AlertTriangle size={16} /> {error}</div>
        )}

        {perfilPendiente ? (
          <>
            <div className="helper-text" style={{ marginBottom: 12 }}>
              Hola, {perfilPendiente.nombre.split(" ")[0]}. Primera vez que entras — ¿eres vendedor o almacenero?
            </div>
            <div className="role-pick">
              <div className={`role-opt vendedor ${rolElegido === "vendedor" ? "selected" : ""}`} onClick={() => setRolElegido("vendedor")}>
                <User size={22} />
                <div className="role-opt-title">Vendedor</div>
              </div>
              <div className={`role-opt almacenero ${rolElegido === "almacenero" ? "selected" : ""}`} onClick={() => setRolElegido("almacenero")}>
                <Warehouse size={22} />
                <div className="role-opt-title">Almacenero</div>
              </div>
            </div>
            <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={!rolElegido || guardandoRol} onClick={confirmarRol}>
              {guardandoRol ? <Loader2 className="spin" size={15} /> : "Entrar"}
            </button>
          </>
        ) : verificando ? (
          <div style={{ textAlign: "center", padding: 20 }}><Loader2 className="spin" size={22} /></div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "center" }} ref={botonRef} />
            <div className="helper-text">
              Solo se usa para identificarte dentro de la app.<br />No se solicita ningún permiso adicional.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
