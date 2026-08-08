import { useState, useRef } from "react";
import { Camera, Upload, Loader2, AlertTriangle, ClipboardList, Plus, Trash2 } from "lucide-react";
import { resizeImageToBase64, uid } from "../helpers.js";
import { api } from "../api.js";

export default function CrearPedido({ onCreado, onCancelar }) {
  const [cliente, setCliente] = useState("");
  const [imgPreview, setImgPreview] = useState(null);
  const [analizando, setAnalizando] = useState(false);
  const [errorOcr, setErrorOcr] = useState("");
  const [items, setItems] = useState([]);
  const fileRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setErrorOcr("");
    setAnalizando(true);
    try {
      const b64 = await resizeImageToBase64(file, 1600);
      setImgPreview("data:image/jpeg;base64," + b64);
      const parsed = await api.transcribir(b64, "image/jpeg");
      if (parsed.cliente && !cliente) setCliente(parsed.cliente);
      setItems(prev => [...prev, ...(parsed.items || []).map(it => ({ ...it, id: it.id || uid("it") }))]);
    } catch (err) {
      setErrorOcr(err.message || "No se pudo leer la imagen automáticamente. Puedes agregar las líneas manualmente abajo.");
    } finally {
      setAnalizando(false);
    }
  }

  function updateItem(id, patch) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  }
  function removeItem(id) {
    setItems(prev => prev.filter(it => it.id !== id));
  }
  function addManualRow() {
    setItems(prev => [...prev, { id: uid("it"), cantidad: 1, codigo: "", matchStatus: "manual", piso: "" }]);
  }

  const puedeEnviar = cliente.trim() && items.length > 0 && items.every(it => it.codigo.trim());

  return (
    <div className="container">
      <div className="page-title">Nuevo pedido</div>
      <div className="page-sub">Sube la lista del cliente — a mano o captura de Excel — y revisa antes de enviar.</div>

      <div className="field">
        <label>Nombre del cliente *</label>
        <input type="text" value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Obligatorio" />
      </div>

      <div className="field">
        <label>Lista del pedido</label>
        {!imgPreview ? (
          <div className="upload-zone" onClick={() => fileRef.current?.click()}>
            <Camera size={26} style={{ marginBottom: 8, opacity: 0.7 }} />
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>Tomar foto o subir imagen</div>
            <div style={{ fontSize: 11.5, marginTop: 4, opacity: 0.7 }}>Foto a mano o captura de Excel</div>
          </div>
        ) : (
          <>
            <img src={imgPreview} className="upload-preview" alt="Lista subida" />
            <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
              <Upload size={13} /> Cambiar imagen
            </button>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFile} />
      </div>

      {analizando && (
        <div className="banner banner-warn"><Loader2 className="spin" size={16} /> Analizando imagen y contrastando con el catálogo de códigos…</div>
      )}
      {errorOcr && (
        <div className="banner banner-warn"><AlertTriangle size={16} /> {errorOcr}</div>
      )}

      {items.length > 0 && (
        <>
          <div className="section-label"><ClipboardList size={13} /> Revisa y corrige antes de enviar</div>
          <table className="item-table">
            <tbody>
              {items.map(it => (
                <tr className="item-row" key={it.id}>
                  <td style={{ width: 46 }}>
                    <input type="number" min="1" className="qty-input" value={it.cantidad}
                      onChange={e => updateItem(it.id, { cantidad: e.target.value })} />
                  </td>
                  <td>
                    <input type="text" className="code-chip" value={it.codigo}
                      onChange={e => updateItem(it.id, { codigo: e.target.value, matchStatus: "manual" })} />
                    <div className={`match-badge match-${it.matchStatus}`} style={{ marginTop: 3 }}>
                      {it.matchStatus === "exacto" && "✓ en catálogo"}
                      {it.matchStatus === "aproximado" && "⚠ corregido, verificar"}
                      {it.matchStatus === "no_encontrado" && "✕ no encontrado — revisar"}
                      {it.matchStatus === "manual" && "editado manualmente"}
                    </div>
                  </td>
                  <td>
                    <button className="row-del" onClick={() => removeItem(it.id)}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={addManualRow}>
        <Plus size={13} /> Agregar línea manual
      </button>

      <div style={{ display: "flex", gap: 10, marginTop: 26 }}>
        <button className="btn btn-outline" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={!puedeEnviar}
          onClick={() => onCreado({ cliente: cliente.trim(), items })}>
          Enviar pedido al almacén
        </button>
      </div>
    </div>
  );
}
