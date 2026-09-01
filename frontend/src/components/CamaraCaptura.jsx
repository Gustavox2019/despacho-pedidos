import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

// Abre la cámara física del dispositivo DIRECTO en el navegador (como
// hace WhatsApp Web o Google Meet), sin depender de la app de Cámara del
// celular — sirve para cuando esa app falla o no abre.
export default function CamaraCaptura({ onCapturar, onCerrar }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Este navegador no soporta acceder a la cámara directamente. Usa la opción de subir/tomar foto normal.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false
        });
        if (cancelado) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setListo(true);
      } catch (err) {
        setError("No se pudo abrir la cámara del navegador. Revisa que le hayas dado permiso de Cámara a esta página (candado 🔒 junto a la dirección web), o usa la opción de subir foto.");
      }
    })();
    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  function capturar() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
    streamRef.current?.getTracks().forEach(t => t.stop());
    onCapturar(base64);
  }

  function cerrar() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    onCerrar();
  }

  return (
    <div className="camara-overlay">
      <button className="lightbox-close" onClick={cerrar}><X size={18} /></button>
      {error ? (
        <div className="camara-error">{error}</div>
      ) : (
        <>
          <video ref={videoRef} playsInline muted className="camara-video" />
          <button className="camara-shutter" onClick={capturar} disabled={!listo} title="Tomar foto">
            <Camera size={26} />
          </button>
        </>
      )}
    </div>
  );
}
