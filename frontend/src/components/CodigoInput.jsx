import { useState, useRef } from "react";
import { api } from "../api.js";

// Input de texto normal, pero con un desplegable de sugerencias del
// catálogo de códigos mientras la persona escribe (para pedidos armados
// a mano, o al corregir un código que la IA no reconoció).
export default function CodigoInput({ value, onChange, className, placeholder, onKeyDown, autoFocus }) {
  const [sugerencias, setSugerencias] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const debounceRef = useRef(null);

  function alCambiar(e) {
    const v = e.target.value;
    onChange(v);
    clearTimeout(debounceRef.current);
    const q = v.trim();
    if (q.length < 2) { setSugerencias([]); setAbierto(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const { codigos } = await api.buscarCodigos(q);
        setSugerencias(codigos || []);
        setAbierto((codigos || []).length > 0);
      } catch (err) { /* silencioso, no bloquea escribir el código a mano */ }
    }, 220);
  }

  function elegir(codigo) {
    onChange(codigo);
    setSugerencias([]);
    setAbierto(false);
  }

  return (
    <div className="codigo-input-wrap">
      <input
        type="text"
        className={className}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={alCambiar}
        onFocus={() => sugerencias.length > 0 && setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        onKeyDown={onKeyDown}
      />
      {abierto && sugerencias.length > 0 && (
        <div className="codigo-suggestions">
          {sugerencias.map(p => (
            // onMouseDown (no onClick) para que se dispare ANTES del blur del input
            <div key={p.codigo} className="codigo-suggestion-item" onMouseDown={() => elegir(p.codigo)}>
              <strong>{p.codigo}</strong>
              {p.descripcion && <span style={{ color: "var(--muted)", marginLeft: 6 }}>{p.descripcion}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
