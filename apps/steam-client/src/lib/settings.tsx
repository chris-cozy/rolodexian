import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const storageKey = "rolodexian.steam-settings.v1";

export interface SteamClientSettings {
  reducedMotion: boolean;
  networkEnabled: boolean;
}

export const defaultSteamSettings: SteamClientSettings = {
  reducedMotion: false,
  networkEnabled: false
};

function loadSettings(): SteamClientSettings {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return defaultSteamSettings;
    const parsed = JSON.parse(stored) as Partial<SteamClientSettings>;
    return {
      reducedMotion: Boolean(parsed.reducedMotion),
      networkEnabled: Boolean(parsed.networkEnabled)
    };
  } catch {
    return defaultSteamSettings;
  }
}

interface SteamSettingsContextValue {
  settings: SteamClientSettings;
  updateSettings: (patch: Partial<SteamClientSettings>) => void;
  resetSettings: () => void;
}

const SteamSettingsContext = createContext<SteamSettingsContextValue | null>(null);

export function SteamSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SteamClientSettings>(loadSettings);

  useEffect(() => {
    document.documentElement.classList.toggle("steam-reduced-motion", settings.reducedMotion);
    window.localStorage.setItem(storageKey, JSON.stringify(settings));
  }, [settings]);

  const value = useMemo<SteamSettingsContextValue>(() => ({
    settings,
    updateSettings: (patch) => setSettings((current) => ({ ...current, ...patch })),
    resetSettings: () => setSettings(defaultSteamSettings)
  }), [settings]);

  return <SteamSettingsContext.Provider value={value}>{children}</SteamSettingsContext.Provider>;
}

export function useSteamSettings() {
  const context = useContext(SteamSettingsContext);
  if (!context) throw new Error("useSteamSettings must be used inside SteamSettingsProvider.");
  return context;
}
