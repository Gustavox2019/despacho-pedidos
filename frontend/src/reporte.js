import * as XLSX from "xlsx";

function fechaCorta(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function isoDia(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

const ENCABEZADO = [
  "Fecha", "ID Pedido", "Cliente", "Vendedor", "Almacenero", "Cajas",
  "Cantidad", "Codigo", "Piso", "Check", "Detalle"
];

// Arma las filas planas (una por producto separado) de los pedidos
// finalizados, agrupadas por fecha — sirve tanto para CSV como para Excel.
// filtro: { fechaDesde, fechaHasta, cliente } — todo opcional; sin fechas = toda la data.
function construirFilas(pedidos, filtro = {}) {
  const { fechaDesde, fechaHasta, cliente } = filtro;

  let finalizados = pedidos.filter(p => p.estado === "finalizado");

  if (fechaDesde || fechaHasta) {
    finalizados = finalizados.filter(p => {
      const iso = isoDia(p.finalizadoEn || p.creadoEn);
      if (fechaDesde && iso < fechaDesde) return false;
      if (fechaHasta && iso > fechaHasta) return false;
      return true;
    });
  }
  if (cliente && cliente.trim()) {
    const q = cliente.trim().toLowerCase();
    finalizados = finalizados.filter(p => p.cliente.toLowerCase().includes(q));
  }

  finalizados.sort((a, b) => (a.finalizadoEn || a.creadoEn) - (b.finalizadoEn || b.creadoEn));

  const filas = [ENCABEZADO];
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
  return filas;
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function nombreArchivo(ext) {
  const hoy = new Date().toISOString().slice(0, 10);
  return `reporte-pedidos-${hoy}.${ext}`;
}

// CSV (se abre directo en Excel / Google Sheets)
export function exportarReporteCSV(pedidos, filtro) {
  const filas = construirFilas(pedidos, filtro);
  const csv = "\uFEFF" + filas.map(fila => fila.map(csvEscape).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nombreArchivo("csv");
  link.click();
  URL.revokeObjectURL(url);
}

// Excel real (.xlsx), con columnas ajustadas
export function exportarReporteXLSX(pedidos, filtro) {
  const filas = construirFilas(pedidos, filtro);
  const hoja = XLSX.utils.aoa_to_sheet(filas);
  hoja["!cols"] = [
    { wch: 11 }, { wch: 11 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 7 },
    { wch: 9 }, { wch: 16 }, { wch: 10 }, { wch: 7 }, { wch: 24 }
  ];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Pedidos");
  XLSX.writeFile(libro, nombreArchivo("xlsx"));
}
