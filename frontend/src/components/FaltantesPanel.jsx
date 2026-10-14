import { useMemo } from "react";
import { PackageX, FileSpreadsheet } from "lucide-react";
import { fmtTime, normCode } from "../helpers.js";

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Exporta la lista de productos con problema a un CSV (se abre directo en
// Excel / Google Sheets) — una fila por cada vez que salió marcado ✕.
function exportarFaltantesCSV(faltantes) {
  const encabezado = ["Codigo", "Veces en total", "Pedido", "Cliente", "Fecha", "Detalle"];
  const filas = [encabezado];
  for (const f of faltantes) {
    for (const a of f.apariciones) {
      filas.push([f.codigo, f.veces, a.pedidoId, a.cliente, new Date(a.fecha).toLocaleString("es-PE"), a.texto || ""]);
    }
  }
  const csv = "﻿" + filas.map(fila => fila.map(csvEscape).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `faltantes-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <div className="page-title">Productos con problema</div>
          <div className="page-sub" style={{ marginBottom: 18 }}>
            Códigos marcados con ✕ en algún pedido — útil para detectar productos que vienen fallando seguido.
          </div>
        </div>
        <button className="btn btn-outline btn-sm" style={{ whiteSpace: "nowrap" }} onClick={() => exportarFaltantesCSV(faltantes)}>
          <FileSpreadsheet size={13} /> Exportar lista
        </button>
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
