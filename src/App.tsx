import type { CSSProperties } from "react";
import { Network, Search, UsersRound } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const rainGlyphs = "010110100111ROLODEXIANNETWORKLOCALDATASTREAM";

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
          <span className="brand-mark">R</span>
          <span>Rolodexian</span>
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
        </nav>
        <div className="system-readout" aria-label="System status">
          <span>LOCALHOST</span>
          <span>DATASTORE: SQLITE</span>
          <span>NETWORK MAP: ONLINE</span>
        </div>
        <div className="top-nav-meta">
          <Search size={16} />
          Local private network
        </div>
      </header>
      <main className="workspace">
        <Outlet />
      </main>
    </div>
  );
}
