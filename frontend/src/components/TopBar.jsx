import { Package, LogOut, ChevronLeft, Bell, BellOff } from "lucide-react";

export default function TopBar({ user, onLogout, onBack, notifPermiso, onActivarNotificaciones, notifCount = 0 }) {
  const notifDisponibles = notifPermiso && notifPermiso !== "unsupported";

  function alTocarCampana() {
    if (notifPermiso === "default") onActivarNotificaciones?.();
    // si ya está "granted" o "denied" no hay nada que pedir de nuevo — el
    // navegador no deja reabrir el diálogo, solo se puede cambiar desde la
    // configuración del sitio.
  }

  return (
    <>
      <div className="hazard-bar" />
      <div className="topbar">
        <div className="brand" style={{ cursor: onBack ? "pointer" : "default" }} onClick={onBack}>
          {onBack ? <ChevronLeft size={20} /> : (
            <div className="brand-mark"><Package size={17} /></div>
          )}
          {!onBack && (
            <div>
              <div className="brand-text">Despacho</div>
            </div>
          )}
        </div>
        <div className="user-chip">
          {notifDisponibles && (
            <button
              className="notif-bell"
              onClick={alTocarCampana}
              title={
                notifPermiso === "granted" ? "Notificaciones activadas"
                : notifPermiso === "denied" ? "Notificaciones bloqueadas (actívalas desde la configuración del navegador)"
                : "Activar notificaciones de pedidos y mensajes nuevos"
              }
            >
              {notifPermiso === "denied" ? <BellOff size={17} /> : <Bell size={17} />}
              {notifPermiso === "granted" && notifCount > 0 && (
                <span className="notif-bell-badge">{notifCount > 9 ? "9+" : notifCount}</span>
              )}
            </button>
          )}
          <span className={`role-badge ${user.rol}`}>{user.rol}</span>
          <button className="icon-btn" onClick={onLogout} title="Salir"><LogOut size={15} /></button>
        </div>
      </div>
    </>
  );
}
