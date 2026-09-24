import { Home, Layers, LogOut, Settings, Upload } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useApp } from "../lib/app-state";
import { Toasts } from "./ui";

const NAV = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/upload?mode=single", label: "Edit", icon: Upload },
  { to: "/batches", label: "Batch", icon: Layers },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Shell() {
  const { logout } = useApp();
  return (
    <div className="shell">
      <nav className="rail" aria-label="Main">
        <div className="logo" aria-hidden>
          N
        </div>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={label} to={to} end={end} className={({ isActive }) => (isActive ? "active" : "")}>
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
        <span className="spacer" />
        <a
          href="#logout"
          onClick={(e) => {
            e.preventDefault();
            logout();
          }}
        >
          <LogOut size={18} />
          Sign out
        </a>
      </nav>
      <main className="main">
        <Outlet />
      </main>
      <Toasts />
    </div>
  );
}
