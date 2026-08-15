export function uid(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2, 9);
}

export function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString("es-PE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// Fecha y hora completas (con año), para momentos puntuales que vale la
// pena dejar bien claros, como cuándo se finalizó un pedido.
export function fmtFechaHora(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString("es-PE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

export async function resizeImageToBase64(file, maxDim, calidad = 0.88) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", calidad);
      resolve(dataUrl.split(",")[1]);
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function pad4(n) { return String(n).padStart(4, "0"); }

// Calcula el % de avance de un pedido para mostrárselo al vendedor y al
// almacenero: 0% pendiente, % de códigos ya marcados (✓ o ✕) mientras está
// "tomado" (aplica igual a pedidos de "separar" o "confirmar", ya que
// ambos usan el checklist línea por línea), 100% finalizado.
export function calcularProgreso(pedido) {
  if (!pedido) return 0;
  if (pedido.estado === "finalizado") return 100;
  if (pedido.estado !== "tomado") return 0;
  const total = pedido.items?.length || 0;
  if (!total) return 0;
  const marcados = pedido.items.filter(it => it.check === "ok" || it.check === "no").length;
  return Math.round((marcados / total) * 100);
}
