function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function fechaCorta(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit" });
}

// Genera un CSV (se abre directo en Excel / Google Sheets) con los productos
// separados de los pedidos finalizados, agrupados por fecha.
export function exportarReporteCSV(pedidos) {
  const finalizados = pedidos
    .filter(p => p.estado === "finalizado")
    .sort((a, b) => (a.finalizadoEn || a.creadoEn) - (b.finalizadoEn || b.creadoEn));

  const encabezado = [
    "Fecha", "ID Pedido", "Cliente", "Vendedor", "Almacenero", "Cajas",
    "Cantidad", "Codigo", "Piso", "Check", "Detalle"
  ];

  const filas = [encabezado];

  for (const p of finalizados) {
    const fecha = fechaCorta(p.finalizadoEn || p.creadoEn);
    for (const it of p.items) {
      filas.push([
        fecha,
        p.id,
        p.cliente,
        p.vendedorNombre,
        p.almaceneroNombre || "",
        p.cajas || "",
        it.cantidad,
        it.codigo,
        it.piso || "",
        it.check === "ok" ? "OK" : it.check === "no" ? "NO" : "",
        it.texto || ""
      ]);
    }
  }

  const csv = "\uFEFF" + filas.map(fila => fila.map(csvEscape).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const hoy = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `reporte-pedidos-${hoy}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
