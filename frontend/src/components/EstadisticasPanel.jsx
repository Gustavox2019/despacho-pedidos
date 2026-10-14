import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Trophy } from "lucide-react";

const COLORES = ["#f2a93b", "#3fc6c1", "#3ecf7e", "#ef5b5b", "#8b96a8", "#c17fe0", "#e08f7f"];

function isoDia(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

// Primer día del mes actual, en formato yyyy-mm-dd (para el filtro por
// defecto: "cuántos pedidos hizo cada quien este mes").
function primerDiaDelMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function EstadisticasPanel({ pedidos }) {
  const [fechaDesde, setFechaDesde] = useState(primerDiaDelMes());
  const [fechaHasta, setFechaHasta] = useState(isoDia(Date.now()));
  const [todaLaData, setTodaLaData] = useState(false);

  const datos = useMemo(() => {
    let finalizados = pedidos.filter(p => (p.estado === "finalizado" || p.estado === "despachado") && p.almaceneroNombre);
    if (!todaLaData) {
      finalizados = finalizados.filter(p => {
        const iso = isoDia(p.finalizadoEn || p.creadoEn);
        if (fechaDesde && iso < fechaDesde) return false;
        if (fechaHasta && iso > fechaHasta) return false;
        return true;
      });
    }
    const conteo = new Map();
    for (const p of finalizados) {
      conteo.set(p.almaceneroNombre, (conteo.get(p.almaceneroNombre) || 0) + 1);
    }
    const total = finalizados.length;
    return [...conteo.entries()]
      .map(([nombre, cantidad]) => ({ nombre, cantidad, porcentaje: total ? Math.round((cantidad / total) * 100) : 0 }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [pedidos, fechaDesde, fechaHasta, todaLaData]);

  const totalFinalizados = datos.reduce((acc, d) => acc + d.cantidad, 0);

  return (
    <div>
      <div className="page-title">¿Quién separa más pedidos?</div>
      <div className="page-sub">Porcentaje de pedidos finalizados por cada almacenero.</div>

      <div className="card" style={{ marginTop: 14, marginBottom: 16 }}>
        <div className="field" style={{ marginBottom: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", textTransform: "none", fontSize: 12.5 }}>
            <input type="checkbox" checked={todaLaData} onChange={e => setTodaLaData(e.target.checked)} />
            Contar toda la data (no solo el rango de fechas)
          </label>
        </div>
        {!todaLaData && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
              <label>Desde</label>
              <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
              <label>Hasta</label>
              <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
            </div>
          </div>
        )}
        <div className="helper-text" style={{ marginTop: 8 }}>
          Por defecto se cuenta solo el mes actual — cambia el rango o marca "toda la data" para ver otro período.
        </div>
      </div>

      {totalFinalizados === 0 ? (
        <div className="empty-state">
          <Trophy size={30} style={{ opacity: 0.4, marginBottom: 10 }} />
          <div>No hay pedidos finalizados en este rango de fechas.</div>
        </div>
      ) : (
        <>
          <div className="page-sub" style={{ marginTop: -6, marginBottom: 10 }}>{totalFinalizados} pedido(s) en total.</div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={datos} dataKey="cantidad" nameKey="nombre" cx="50%" cy="50%" outerRadius={95}
                  label={({ porcentaje }) => `${porcentaje}%`}>
                  {datos.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} pedido(s)`, name]}
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: 10 }}>
            {datos.map((d, i) => (
              <div key={d.nombre} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: COLORES[i % COLORES.length], display: "inline-block" }} />
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>{d.nombre}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>{d.cantidad} pedido(s) · <strong style={{ color: "var(--text)" }}>{d.porcentaje}%</strong></div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
