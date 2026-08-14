import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { Camera, Upload, Loader2, AlertTriangle, ClipboardList, Plus, Trash2, Layers, FileSpreadsheet, Clipboard, Layers3, CheckCircle2 } from "lucide-react";
import { resizeImageToBase64, uid } from "../helpers.js";
import { parsearExcel } from "../excelParser.js";
import { api } from "../api.js";

export default function CrearPedido({ onCreado, onCancelar, errorEnvio }) {
  const [cliente, setCliente] = useState("");
  const [imgPreview, setImgPreview] = useState(null);
  const [fotoGuardada, setFotoGuardada] = useState(null); // versión liviana que sí se guarda en el pedido
  const [verFotoCompleta, setVerFotoCompleta] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [errorOcr, setErrorOcr] = useState("");
  const [items, setItems] = useState([]);
  const [tipoAtencion, setTipoAtencion] = useState(null); // "separar" | "confirmar"
  const [enviando, setEnviando] = useState(false);
  const fileRefCamara = useRef(null);
  const fileRefGaleria = useRef(null);
  const fileRefExcel = useRef(null);
  const clienteRef = useRef(cliente);
  clienteRef.current = cliente;

  const procesarImagen = useCallback(async (file) => {
    if (!file) return;
    setErrorOcr("");
    setAnalizando(true);
    try {
      const b64 = await resizeImageToBase64(file, 1600);
      setImgPreview("data:image/jpeg;base64," + b64);
      // versión más liviana, es la que se guarda en el pedido (para no pasar el límite de la base de datos)
      const b64Guardado = await resizeImageToBase64(file, 900, 0.6);
      setFotoGuardada("data:image/jpeg;base64," + b64Guardado);
      const parsed = await api.transcribir(b64, "image/jpeg");
      if (parsed.cliente && !clienteRef.current) setCliente(parsed.cliente);
      setItems(prev => [...prev, ...(parsed.items || []).map(it => ({ ...it, id: it.id || uid("it") }))]);
    } catch (err) {
      setErrorOcr(err.message || "No se pudo leer la imagen automáticamente. Puedes agregar las líneas manualmente abajo.");
    } finally {
      setAnalizando(false);
    }
  }, []);

  async function procesarExcel(file) {
    if (!file) return;
    setErrorOcr("");
    setAnalizando(true);
    try {
      const filas = await parsearExcel(file);
      if (filas.length === 0) {
        setErrorOcr("No se encontraron filas reconocibles en el archivo.");
        return;
      }
      const resultado = await api.matchLista(filas);
      setItems(prev => [...prev, ...resultado.items.map(it => ({ ...it, id: it.id || uid("it") }))]);
    } catch (err) {
      setErrorOcr(err.message || "No se pudo leer el archivo Excel.");
    } finally {
      setAnalizando(false);
    }
  }

  // Permite pegar una imagen copiada (Ctrl+V / Cmd+V), por ejemplo una
  // captura de pantalla de Excel copiada directamente, sin guardarla primero.
  useEffect(() => {
    function alPegar(e) {
      const elementos = e.clipboardData?.items;
      if (!elementos) return;
      for (const el of elementos) {
        if (el.type.startsWith("image/")) {
          const file = el.getAsFile();
          if (file) {
            e.preventDefault();
            procesarImagen(file);
          }
          break;
        }
      }
    }
    window.addEventListener("paste", alPegar);
    return () => window.removeEventListener("paste", alPegar);
  }, [procesarImagen]);

  function updateItem(id, patch) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  }
  function removeItem(id) {
    setItems(prev => prev.filter(it => it.id !== id));
  }
  function addManualRow() {
    setItems(prev => [...prev, { id: uid("it"), cantidad: 1, codigo: "", matchStatus: "manual", piso: "" }]);
  }

  const gruposRepetidos = useMemo(() => {
    const porCodigo = new Map();
    for (const it of items) {
      const clave = (it.codigo || "").trim().toUpperCase();
      if (!clave) continue;
      if (!porCodigo.has(clave)) porCodigo.set(clave, []);
      porCodigo.get(clave).push(it);
    }
    return [...porCodigo.entries()].filter(([, grupo]) => grupo.length > 1);
  }, [items]);

  function juntarRepetidos() {
    setItems(prev => {
      const vistos = new Map();
      const resultado = [];
      for (const it of prev) {
        const clave = (it.codigo || "").trim().toUpperCase();
        if (clave && vistos.has(clave)) {
          const original = vistos.get(clave);
          original.cantidad = (Number(original.cantidad) || 0) + (Number(it.cantidad) || 0);
        } else {
          const copia = { ...it };
          resultado.push(copia);
          if (clave) vistos.set(clave, copia);
        }
      }
      return resultado;
    });
  }

  async function handleEnviar() {
    setEnviando(true);
    try {
      await onCreado({ cliente: cliente.trim(), items, foto: fotoGuardada, tipo: tipoAtencion });
    } finally {
      setEnviando(false);
    }
  }

  const puedeEnviar = cliente.trim() && items.length > 0 && items.every(it => it.codigo.trim()) && tipoAtencion && !enviando;

  return (
    <div className="container container-wide">
      <div className="page-title">Nuevo pedido</div>
      <div className="page-sub">Sube la lista del cliente — foto, Excel, o pega una imagen — y revisa antes de enviar.</div>

      <div className="field">
        <label>Nombre del cliente *</label>
        <input type="text" value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Obligatorio" />
      </div>

      <div className="crear-grid">
        <div className="area-upload">
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Lista del pedido</label>
            {!imgPreview ? (
              <div className="upload-options">
                <div className="upload-opt-btn" onClick={() => fileRefCamara.current?.click()}>
                  <Camera size={22} />
                  <div style={{ fontWeight: 700, fontSize: 12.5 }}>Tomar foto</div>
                </div>
                <div className="upload-opt-btn" onClick={() => fileRefGaleria.current?.click()}>
                  <Upload size={22} />
                  <div style={{ fontWeight: 700, fontSize: 12.5 }}>Galería</div>
                </div>
                <div className="upload-opt-btn" onClick={() => fileRefExcel.current?.click()}>
                  <FileSpreadsheet size={22} />
                  <div style={{ fontWeight: 700, fontSize: 12.5 }}>Excel</div>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-outline btn-sm" onClick={() => fileRefCamara.current?.click()}>
                  <Camera size={13} /> Tomar otra foto
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => fileRefGaleria.current?.click()}>
                  <Upload size={13} /> Elegir otra
                </button>
              </div>
            )}
            <div className="helper-text" style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
              <Clipboard size={12} /> También puedes pegar una imagen copiada con Ctrl+V
            </div>
            {/* capture="environment" abre la cámara directamente en celulares */}
            <input ref={fileRefCamara} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
              onChange={e => procesarImagen(e.target.files[0])} />
            {/* sin "capture" para que el navegador muestre la galería/explorador de archivos */}
            <input ref={fileRefGaleria} type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => procesarImagen(e.target.files[0])} />
            <input ref={fileRefExcel} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
              onChange={e => procesarExcel(e.target.files[0])} />
          </div>

          {analizando && (
            <div className="banner banner-warn"><Loader2 className="spin" size={16} /> Procesando y contrastando con el catálogo de códigos…</div>
          )}
          {errorOcr && (
            <div className="banner banner-warn"><AlertTriangle size={16} /> {errorOcr}</div>
          )}

          {gruposRepetidos.length > 0 && (
            <div className="banner banner-warn">
              <Layers size={16} />
              <div style={{ flex: 1 }}>
                <div>Hay {gruposRepetidos.length} código(s) repetido(s):</div>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontFamily: "var(--mono)", fontSize: 12 }}>
                  {gruposRepetidos.map(([codigo, grupo]) => (
                    <li key={codigo}>{codigo} — aparece {grupo.length} veces</li>
                  ))}
                </ul>
                <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={juntarRepetidos}>
                  Juntar códigos repetidos
                </button>
              </div>
            </div>
          )}

          {items.length > 0 && (
            <>
              <div className="section-label"><ClipboardList size={13} /> Revisa y corrige antes de enviar</div>
              <div className="checklist-box">
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
              </div>
            </>
          )}

          <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={addManualRow}>
            <Plus size={13} /> Agregar línea manual
          </button>

          <div className="field" style={{ marginTop: 22 }}>
            <label>¿Cómo debe atenderse este pedido? *</label>
            <div className="role-pick">
              <div className={`role-opt vendedor ${tipoAtencion === "separar" ? "selected" : ""}`} onClick={() => setTipoAtencion("separar")}>
                <Layers3 size={20} />
                <div className="role-opt-title">Separar</div>
              </div>
              <div className={`role-opt almacenero ${tipoAtencion === "confirmar" ? "selected" : ""}`} onClick={() => setTipoAtencion("confirmar")}>
                <CheckCircle2 size={20} />
                <div className="role-opt-title">Confirmar</div>
              </div>
            </div>
            <div className="helper-text" style={{ marginTop: 6 }}>
              "Separar" abre el checklist para armar cajas en almacén · "Confirmar" solo valida el pedido rápidamente.
            </div>
          </div>

          {errorEnvio && (
            <div className="banner banner-warn"><AlertTriangle size={16} /> {errorEnvio}</div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="btn btn-outline" onClick={onCancelar}>Cancelar</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={!puedeEnviar}
              onClick={handleEnviar}>
              {enviando ? <Loader2 className="spin" size={15} /> : "Enviar pedido al almacén"}
            </button>
          </div>
        </div>

        {imgPreview && (
          <div className="area-preview">
            <img src={imgPreview} className="upload-preview" alt="Lista subida" onClick={() => setVerFotoCompleta(true)} />
          </div>
        )}
      </div>

      {verFotoCompleta && imgPreview && (
        <div className="lightbox-overlay" onClick={() => setVerFotoCompleta(false)}>
          <button className="lightbox-close" onClick={() => setVerFotoCompleta(false)}>✕</button>
          <img src={imgPreview} alt="Lista en tamaño completo" />
        </div>
      )}
    </div>
  );
}
