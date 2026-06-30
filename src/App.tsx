import type { CSSProperties } from "react";
import { ArchiveRestore, Network, Settings, UsersRound } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useSettings } from "./lib/settings";

const rainGlyphs = "010110100111ROLODEXIANNETWORKLOCALDATASTREAM";
const appVersion = "v0.1.0";

type RainStyle = CSSProperties & {
  "--rain-x": string;
  "--rain-delay": string;
  "--rain-duration": string;
  "--rain-opacity": string;
};

const rainColumns = Array.from({ length: 96 }, (_, index) => ({
  id: index,
  text: Array.from({ length: 108 }, (_, glyphIndex) => rainGlyphs[(glyphIndex + index * 5) % rainGlyphs.length]).join("\n"),
  style: {
    "--rain-x": `${(index / 95) * 100}%`,
    "--rain-delay": `${-((index * 0.31) % 9.4)}s`,
    "--rain-duration": `${6.8 + (index % 11) * 0.52}s`,
    "--rain-opacity": `${0.24 + (index % 7) * 0.055}`
  } as RainStyle
}));

export default function App() {
  const { settings } = useSettings();
  const shellClasses = [
    "app-shell",
    `matrix-rain-${settings.matrixRain}`,
    settings.reducedMotion ? "reduced-motion" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClasses}>
      {settings.matrixRain !== "off" ? (
        <div className="matrix-rain" aria-hidden="true">
          {rainColumns.map((column) => (
            <span className="matrix-rain-column" key={column.id} style={column.style}>
              {column.text}
            </span>
          ))}
        </div>
      ) : null}
      <header className="top-nav">
        <NavLink to="/" className="brand" aria-label="Dexian OS contacts">
          <span className="brand-title">DEXIAN OS</span>
        </NavLink>
        <nav className="nav-list" aria-label="Primary">
          <NavLink to="/" end>
            <UsersRound size={18} />
            Contacts
          </NavLink>
          <NavLink to="/graph">
            <Network size={18} />
            Graph
          </NavLink>
          <NavLink to="/contacts/import-export">
            <ArchiveRestore size={18} />
            Import/Export
          </NavLink>
          <NavLink to="/settings">
            <Settings size={18} />
            Settings
          </NavLink>
        </nav>
        <div className="system-readout" aria-label="System status">
          <span>LOCALHOST</span>
          <span>DATASTORE: SQLITE</span>
          <span>NETWORK MAP: ONLINE</span>
          <span>VERSION: {appVersion}</span>
        </div>
      </header>
      <main className="workspace">
        <Outlet />
      </main>
    </div>
  );
}
