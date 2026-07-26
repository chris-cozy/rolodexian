import { useEffect, useState, type CSSProperties } from "react";
import { LockKeyhole, Network, UsersRound } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const rainGlyphs = "010110100111ROLODEXIANPERSONNELRELATIONMAPVAULTENCRYPTED";

type RainStyle = CSSProperties & {
  "--rain-x": string;
  "--rain-delay": string;
  "--rain-duration": string;
  "--rain-opacity": string;
};

const rainColumns = Array.from({ length: 42 }, (_, index) => ({
  id: index,
  text: Array.from({ length: 72 }, (_, glyphIndex) => rainGlyphs[(glyphIndex + index * 3) % rainGlyphs.length]).join("\n"),
  style: {
    "--rain-x": `${(index / 41) * 100}%`,
    "--rain-delay": `${-((index * 0.43) % 8.2)}s`,
    "--rain-duration": `${8.5 + (index % 9) * 0.8}s`,
    "--rain-opacity": `${0.18 + (index % 6) * 0.055}`
  } as RainStyle
}));

export default function App() {
  const { pathname } = useLocation();
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  const zuluTime = clock.toISOString().slice(11, 19);

  return (
    <div className="app-shell">
      <div className="matrix-rain" aria-hidden="true">
        {rainColumns.map((column) => (
          <span className="matrix-rain-column" key={column.id} style={column.style}>
            {column.text}
          </span>
        ))}
      </div>
      <header className="top-nav">
        <NavLink to="/" className="brand" aria-label="Rolodexian contacts">
          <span className="brand-mark">RX</span>
          <span className="brand-copy">
            <strong>Rolodexian</strong>
            <small>Personal intelligence archive</small>
          </span>
        </NavLink>
        <nav className="nav-list" aria-label="Primary">
          <NavLink to="/" end>
            <UsersRound size={18} />
            Personnel
          </NavLink>
          <NavLink to="/graph">
            <Network size={18} />
            Relation Map
          </NavLink>
        </nav>
        <div className="system-readout" aria-label="System status">
          <span>Local Vault // Online</span>
          <span>AES-256 Encrypted</span>
          <span>Topology Ready</span>
        </div>
        <div className="top-nav-meta">
          <LockKeyhole size={15} />
          Clearance L3
        </div>
      </header>
      <main className="workspace">
        <Outlet />
      </main>
      <footer className="mission-footer" aria-label="Mission telemetry">
        <div className="mission-state">
          <strong>Mission Status</strong>
          <span>Ready</span>
          <i aria-hidden="true" />
        </div>
        <div><span>Operator:</span><strong>User-01</strong></div>
        <div><span>Clearance:</span><strong>Level 3</strong></div>
        <div><span>Session ID:</span><strong>RXN-7A19-3F2B</strong></div>
        <div><span>Uptime:</span><strong>{zuluTime} Z</strong></div>
        <div className="mission-health" aria-label="System health 98 percent">
          <span>System Health</span>
          <i aria-hidden="true" />
          <strong>98%</strong>
        </div>
      </footer>
    </div>
  );
}
