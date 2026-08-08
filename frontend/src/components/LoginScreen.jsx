import { useState } from "react";
import { Package, User, Warehouse } from "lucide-react";
import { uid } from "../helpers.js";

export default function LoginScreen({ onLogin }) {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [rol, setRol] = useState(null);

  const puedeEntrar = nombre.trim() && correo.trim() && rol;

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

        <div className="field">
          <label>Nombre</label>
          <input type="text" placeholder="Como te conocen en el almacén" value={nombre}
            onChange={e => setNombre(e.target.value)} />
        </div>
        <div className="field">
          <label>Correo</label>
          <input type="email" placeholder="tucorreo@gmail.com" value={correo}
            onChange={e => setCorreo(e.target.value)} />
        </div>
        <div className="field">
          <label>Eres</label>
          <div className="role-pick">
            <div className={`role-opt vendedor ${rol === "vendedor" ? "selected" : ""}`} onClick={() => setRol("vendedor")}>
              <User size={22} />
              <div className="role-opt-title">Vendedor</div>
            </div>
            <div className={`role-opt almacenero ${rol === "almacenero" ? "selected" : ""}`} onClick={() => setRol("almacenero")}>
              <Warehouse size={22} />
              <div className="role-opt-title">Almacenero</div>
            </div>
          </div>
        </div>
        <button className="btn btn-primary btn-block" disabled={!puedeEntrar}
          onClick={() => onLogin({ nombre: nombre.trim(), correo: correo.trim(), rol, id: uid("u") })}>
          Entrar
        </button>
        <div className="helper-text">
          Login simple por ahora (sin contraseña).<br />Más adelante se puede conectar con cuenta de Google real.
        </div>
      </div>
    </div>
  );
}
