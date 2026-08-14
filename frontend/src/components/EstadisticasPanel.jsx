import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Trophy } from "lucide-react";

const COLORES = ["#f2a93b", "#3fc6c1", "#3ecf7e", "#ef5b5b", "#8b96a8", "#c17fe0", "#e08f7f"];

export default function EstadisticasPanel({ pedidos }) {
  const datos = useMemo(() => {
    const finalizados = pedidos.filter(p => p.estado === "finalizado" && p.almaceneroNombre);
    const conteo = new Map();
    for (const p of finalizados) {
      conteo.set(p.almaceneroNombre, (conteo.get(p.almaceneroNombre) || 0) + 1);
    }
    const total = finalizados.length;
    return [...conteo.entries()]
      .map(([nombre, cantidad]) => ({ nombre, cantidad, porcentaje: total ? Math.round((cantidad / total) * 100) : 0 }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [pedidos]);

  const totalFinalizados = datos.reduce((acc, d) => acc + d.cantidad, 0);

  if (totalFinalizados === 0) {
    return (
      <div className="empty-state">
        <Trophy size={30} style={{ opacity: 0.4, marginBottom: 10 }} />
        <div>Todavía no hay pedidos finalizados para mostrar estadísticas.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-title">¿Quién separa más pedidos?</div>
      <div className="page-sub">Porcentaje de pedidos finalizados por cada almacenero — {totalFinalizados} pedido(s) en total.</div>

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
    </div>
  );
}
