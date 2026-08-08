import { useState, useEffect, useCallback } from "react";
import { Send } from "lucide-react";
import { fmtTime } from "../helpers.js";
import { api } from "../api.js";

export default function ChatPanel({ pedidoId, user }) {
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [cargado, setCargado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const msgs = await api.listarChat(pedidoId);
      setMensajes(msgs);
    } catch (e) { /* silencioso, se reintenta en el siguiente poll */ }
    setCargado(true);
  }, [pedidoId]);

  useEffect(() => {
    cargar();
    const iv = setInterval(cargar, 4000);
    return () => clearInterval(iv);
  }, [cargar]);

  async function enviar() {
    const t = texto.trim();
    if (!t) return;
    setTexto("");
    try {
      const actualizados = await api.enviarChat(pedidoId, { autor: user.nombre, rol: user.rol, texto: t });
      setMensajes(actualizados);
    } catch (e) { /* si falla, se vuelve a cargar en el próximo poll */ }
  }

  return (
    <div className="chat-wrap">
      <div className="chat-msgs">
        {cargado && mensajes.length === 0 && (
          <div style={{ fontSize: 12.5, color: "var(--muted2)" }}>Sin mensajes todavía. Úsalo si algún código presenta duda de stock.</div>
        )}
        {mensajes.map(m => (
          <div className={`msg ${m.autor === user.nombre ? "mine" : ""}`} key={m.id}>
            <div className="msg-bubble">{m.texto}</div>
            <div className="msg-meta">{m.autor} · {fmtTime(m.ts)}</div>
          </div>
        ))}
      </div>
      <div className="chat-input-row">
        <input type="text" placeholder="Escribe un mensaje…" value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => e.key === "Enter" && enviar()} />
        <button className="icon-btn" onClick={enviar}><Send size={15} /></button>
      </div>
    </div>
  );
}
