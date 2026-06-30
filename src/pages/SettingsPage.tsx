import { EyeOff, Monitor, Palette, RotateCcw, Settings as SettingsIcon, Zap } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { defaultSettings, settingsStorageKey, useSettings } from "../lib/settings";
import type { AppSettings } from "../types";

const accentPresets = ["#57ffb8", "#64d8ff", "#ff7ab6", "#ffd166", "#a78bfa", "#f97316"];

const matrixModes: Array<{ value: AppSettings["matrixRain"]; label: string }> = [
  { value: "full", label: "Full" },
  { value: "subtle", label: "Subtle" },
  { value: "off", label: "Off" }
];

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const [colorDraft, setColorDraft] = useState(settings.accentColor);

  useEffect(() => {
    setColorDraft(settings.accentColor);
  }, [settings.accentColor]);

  function commitColor(value: string) {
    if (/^#[0-9a-f]{6}$/i.test(value.trim())) {
      updateSettings({ accentColor: value.trim().toLowerCase() });
    } else {
      setColorDraft(settings.accentColor);
    }
  }

  return (
    <div className="page narrow-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Application</p>
          <h1>Settings</h1>
        </div>
        <button className="secondary-button" type="button" onClick={resetSettings}>
          <RotateCcw size={16} />
          Reset
        </button>
      </header>

      <div className="data-strip">
        <span>Storage: {settingsStorageKey}</span>
        <span>Accent: {settings.accentColor}</span>
        <span>Motion: {settings.reducedMotion ? "reduced" : "standard"}</span>
      </div>

      <div className="settings-grid">
        <section className="form-section">
          <div className="section-heading">
            <h2>Accent Color</h2>
            <Palette size={18} />
          </div>
          <div className="accent-control">
            <label>
              Color
              <input
                type="color"
                value={settings.accentColor}
                onChange={(event) => updateSettings({ accentColor: event.target.value })}
              />
            </label>
            <label>
              Hex
              <input
                value={colorDraft}
                onBlur={(event) => commitColor(event.target.value)}
                onChange={(event) => setColorDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitColor(event.currentTarget.value);
                }}
              />
            </label>
          </div>
          <div className="swatch-list" aria-label="Accent presets">
            {accentPresets.map((color) => (
              <button
                className={settings.accentColor === color ? "swatch-button active" : "swatch-button"}
                key={color}
                type="button"
                style={{ "--swatch": color } as CSSProperties}
                title={color}
                aria-label={`Set accent ${color}`}
                onClick={() => updateSettings({ accentColor: color })}
              />
            ))}
          </div>
        </section>

        <section className="form-section">
          <div className="section-heading">
            <h2>Visual Comfort</h2>
            <SettingsIcon size={18} />
          </div>
          <label>
            Matrix rain
            <div className="segmented-control">
              {matrixModes.map((mode) => (
                <button
                  className={settings.matrixRain === mode.value ? "segment-button active" : "segment-button"}
                  key={mode.value}
                  type="button"
                  onClick={() => updateSettings({ matrixRain: mode.value })}
                >
                  {mode.value === "off" ? <EyeOff size={16} /> : mode.value === "subtle" ? <Monitor size={16} /> : <Zap size={16} />}
                  {mode.label}
                </button>
              ))}
            </div>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(event) => updateSettings({ reducedMotion: event.target.checked })}
            />
            Reduced motion
          </label>
        </section>
      </div>

      <section className="info-section settings-preview">
        <div className="section-heading">
          <h2>Preview</h2>
          <Monitor size={18} />
        </div>
        <div className="metric-grid">
          <div>
            <span>Default</span>
            <strong>{defaultSettings.accentColor}</strong>
            <small>Accent baseline</small>
          </div>
          <div>
            <span>Current</span>
            <strong>{settings.accentColor}</strong>
            <small>{settings.matrixRain} rain</small>
          </div>
          <div>
            <span>Motion</span>
            <strong>{settings.reducedMotion ? "Reduced" : "Standard"}</strong>
            <small>Interface animation</small>
          </div>
        </div>
      </section>
    </div>
  );
}
