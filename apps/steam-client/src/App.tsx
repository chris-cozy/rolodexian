import { ArchiveRestore, Network, Settings, UsersRound } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useSteamSettings } from "./lib/settings";

export default function App() {
  const { settings } = useSteamSettings();
  return (
    <div className="steam-app">
      <header className="steam-topbar">
        <NavLink className="steam-brand" to="/">
          <span className="brand-symbol">RX</span>
          <span><strong>ROLODEXIAN</strong><small>PEOPLE LIBRARY</small></span>
        </NavLink>
        <nav aria-label="Primary">
          <NavLink to="/" end><UsersRound size={17} /> Library</NavLink>
          {settings.networkEnabled ? <NavLink to="/graph"><Network size={17} /> Network</NavLink> : null}
          <NavLink to="/contacts/import-export"><ArchiveRestore size={17} /> Transfer</NavLink>
          <NavLink to="/settings"><Settings size={17} /> Settings</NavLink>
        </nav>
      </header>
      <main className="steam-workspace"><Outlet /></main>
    </div>
  );
}
