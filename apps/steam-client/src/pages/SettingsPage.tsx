import { ExternalLink, Monitor, Moon, Network, RotateCcw } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useSteamSettings } from "../lib/settings";

export default function SettingsPage() {
  const location = useLocation();
  const { settings, updateSettings, resetSettings } = useSteamSettings();
  return (
    <div className="page narrow-page steam-utility-page">
      <header className="page-header"><div><p className="eyebrow">CLIENT</p><h1>Interface Settings</h1><p>Personalize this device without changing shared contact data.</p></div></header>
      <div className="settings-cards">
        <section className="glass-panel utility-card">
          <Moon size={22} /><div><h2>Steam-inspired client</h2><p>This is the default immersive people-library experience.</p></div>
        </section>
        <section className="glass-panel utility-card">
          <Monitor size={22} /><div><h2>Motion</h2><p>Reduce decorative transitions and animated interface effects.</p>
            <label className="toggle-row"><input type="checkbox" checked={settings.reducedMotion} onChange={(event) => updateSettings({ reducedMotion: event.target.checked })} /> Reduced motion</label>
          </div>
        </section>
        <section className="glass-panel utility-card">
          <Network size={22} /><div><h2>Relationship network</h2><p>This experimental view is hidden from navigation until explicitly enabled.</p>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={settings.networkEnabled}
                onChange={(event) => updateSettings({ networkEnabled: event.target.checked })}
              />
              Enable Network tab
            </label>
          </div>
        </section>
        <section className="glass-panel utility-card">
          <ExternalLink size={22} /><div><h2>Retrofuturist client</h2><p>Open the preserved command-center interface with the same local records.</p>
            <a className="primary-button" href={`/retro${location.pathname}${location.search}`}><ExternalLink size={15} /> Open retro client</a>
          </div>
        </section>
      </div>
      <button className="secondary-button" onClick={resetSettings}><RotateCcw size={15} /> Reset local settings</button>
    </div>
  );
}
