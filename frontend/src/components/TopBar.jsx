import { Package, LogOut, ChevronLeft } from "lucide-react";

export default function TopBar({ user, onLogout, onBack }) {
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
          <span className={`role-badge ${user.rol}`}>{user.rol}</span>
          <button className="icon-btn" onClick={onLogout} title="Salir"><LogOut size={15} /></button>
        </div>
      </div>
    </>
  );
}
