import { useMemo } from "react";
import { PackageX } from "lucide-react";
import { fmtTime, normCode } from "../helpers.js";

// Junta, de todos los pedidos, los códigos que en algún momento se
// marcaron con ✕ (problema) — sirve para ver rápido qué productos vienen
// dando problemas seguido (dañados, mal etiquetados, sin stock real, etc.)
export default function FaltantesPanel({ pedidos }) {
  const faltantes = useMemo(() => {
    const mapa = new Map(); // codigo normalizado -> { codigo, veces, apariciones: [] }
    for (const p of pedidos) {
      for (const it of p.items || []) {
        if (it.check !== "no") continue;
        const key = normCode(it.codigo);
        if (!mapa.has(key)) mapa.set(key, { codigo: it.codigo, veces: 0, apariciones: [] });
        const entrada = mapa.get(key);
        entrada.veces++;
        entrada.apariciones.push({
          pedidoId: p.id, cliente: p.cliente, fecha: p.creadoEn, texto: it.texto || ""
        });
      }
    }
    return [...mapa.values()].sort((a, b) => b.veces - a.veces);
  }, [pedidos]);

  if (faltantes.length === 0) {
    return (
      <div className="empty-state">
        <PackageX size={30} style={{ opacity: 0.4, marginBottom: 10 }} />
        <div>Ningún código ha sido marcado con problema todavía.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-title">Productos con problema</div>
      <div className="page-sub" style={{ marginBottom: 18 }}>
        Códigos marcados con ✕ en algún pedido — útil para detectar productos que vienen fallando seguido.
      </div>
      {faltantes.map(f => (
        <div className="faltante-card" key={f.codigo}>
          <div className="faltante-header">
            <span className="faltante-codigo">{f.codigo}</span>
            <span className="faltante-count">{f.veces} vez{f.veces > 1 ? "es" : ""}</span>
          </div>
          {f.apariciones.map((a, i) => (
            <div className="faltante-item" key={i}>
              <strong>{a.pedidoId}</strong> · {a.cliente} · {fmtTime(a.fecha)}
              {a.texto && <div style={{ marginTop: 3, color: "var(--amber)" }}>"{a.texto}"</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
