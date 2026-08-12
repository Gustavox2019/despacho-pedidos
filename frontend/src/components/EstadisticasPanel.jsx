import { useMemo } from "react";
import { ChevronLeft, BarChart3, Layers, BadgeCheck } from "lucide-react";

// Cuenta, por persona, cuántas listas "separó" (armó cajas) vs cuántas
// solo "confirmó", y calcula el % que representa cada una sobre el total
// de listas separadas — para comparar quién separa más que otros.
function calcularEstadisticas(pedidos) {
  const atendidos = pedidos.filter(p => p.estado !== "pendiente" && p.almaceneroNombre && p.modoAtencion);

  const porPersona = new Map();
  for (const p of atendidos) {
    const nombre = p.almaceneroNombre;
    if (!porPersona.has(nombre)) porPersona.set(nombre, { nombre, separados: 0, confirmados: 0 });
    const entrada = porPersona.get(nombre);
    if (p.modoAtencion === "separar") entrada.separados += 1;
    else if (p.modoAtencion === "confirmar") entrada.confirmados += 1;
  }

  const totalSeparados = [...porPersona.values()].reduce((acc, e) => acc + e.separados, 0);
  const filas = [...porPersona.values()]
    .map(e => ({ ...e, porcentaje: totalSeparados > 0 ? (e.separados / totalSeparados) * 100 : 0 }))
    .sort((a, b) => b.separados - a.separados);

  return { filas, totalSeparados, totalConfirmados: [...porPersona.values()].reduce((acc, e) => acc + e.confirmados, 0) };
}

export default function EstadisticasPanel({ pedidos, onVolver }) {
  const { filas, totalSeparados, totalConfirmados } = useMemo(() => calcularEstadisticas(pedidos), [pedidos]);

  return (
    <div className="container">
      <div className="page-title"><BarChart3 size={18} style={{ verticalAlign: -3, marginRight: 6 }} /> Estadísticas</div>
      <div className="page-sub">Porcentaje de listas separadas por cada persona, sobre el total de listas separadas.</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <div className="card" style={{ flex: 1, textAlign: "center", padding: "14px 10px" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--amber)" }}>{totalSeparados}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <Layers size={11} style={{ verticalAlign: -1 }} /> Separadas
          </div>
        </div>
        <div className="card" style={{ flex: 1, textAlign: "center", padding: "14px 10px" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--teal)" }}>{totalConfirmados}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <BadgeCheck size={11} style={{ verticalAlign: -1 }} /> Confirmadas
          </div>
        </div>
      </div>

      {filas.length === 0 ? (
        <div className="empty-state">Aún no hay pedidos tomados para mostrar estadísticas.</div>
      ) : (
        <div className="card">
          {filas.map(f => (
            <div key={f.nombre} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                <span style={{ fontWeight: 700 }}>{f.nombre}</span>
                <span style={{ color: "var(--muted)" }}>
                  {f.separados} separada(s){f.confirmados ? ` · ${f.confirmados} confirmada(s)` : ""} · {f.porcentaje.toFixed(0)}%
                </span>
              </div>
              <div style={{ height: 10, borderRadius: 6, background: "var(--surface2)", border: "1px solid var(--border)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${Math.max(f.porcentaje, f.porcentaje > 0 ? 2 : 0)}%`,
                  background: "var(--amber)", borderRadius: 6, transition: "width .3s"
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <button className="btn btn-outline" onClick={onVolver}><ChevronLeft size={14} /> Volver</button>
      </div>
    </div>
  );
}
