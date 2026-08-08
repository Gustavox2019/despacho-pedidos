function wrapCenterText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "", lines = [];
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line); line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  lines = lines.slice(0, 2);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
}

function dibujarEtiqueta(pedido, cajaIdx, totalCajas) {
  const canvas = document.createElement("canvas");
  canvas.width = 900; canvas.height = 620;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#111"; ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);

  ctx.fillStyle = "#111";
  ctx.fillRect(14, 14, canvas.width - 28, 74);
  ctx.fillStyle = "#fff";
  ctx.font = "800 26px Arial";
  ctx.textAlign = "left";
  ctx.fillText("PEDIDO", 34, 62);
  ctx.textAlign = "right";
  ctx.font = "800 30px monospace";
  ctx.fillText(pedido.id, canvas.width - 34, 62);

  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.font = "700 20px Arial";
  ctx.fillText("CLIENTE", canvas.width / 2, 150);
  ctx.font = "900 54px Arial";
  wrapCenterText(ctx, (pedido.cliente || "").toUpperCase(), canvas.width / 2, 210, canvas.width - 80, 58);

  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = "#999"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(40, 340); ctx.lineTo(canvas.width - 40, 340); ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = "left";
  ctx.font = "700 16px Arial"; ctx.fillStyle = "#555";
  ctx.fillText("VENDEDOR", 40, 390);
  ctx.font = "700 26px Arial"; ctx.fillStyle = "#111";
  ctx.fillText(pedido.vendedorNombre, 40, 425);

  ctx.textAlign = "right";
  ctx.font = "700 16px Arial"; ctx.fillStyle = "#555";
  ctx.fillText("CAJA", canvas.width - 40, 390);
  ctx.font = "900 64px Arial"; ctx.fillStyle = "#111";
  ctx.fillText(`${cajaIdx} / ${totalCajas}`, canvas.width - 40, 460);

  ctx.textAlign = "center";
  ctx.font = "600 13px Arial"; ctx.fillStyle = "#888";
  ctx.fillText(`Total de cajas del pedido: ${totalCajas}`, canvas.width / 2, 560);

  return canvas;
}

export function descargarEtiquetas(pedido) {
  const total = pedido.cajas || 1;
  for (let i = 1; i <= total; i++) {
    const canvas = dibujarEtiqueta(pedido, i, total);
    const link = document.createElement("a");
    link.download = `${pedido.id}-caja-${i}-de-${total}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }
}
