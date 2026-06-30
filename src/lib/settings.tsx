import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import type { AppSettings } from "../types";

export const settingsStorageKey = "rolodexian.settings.v1";

export const defaultSettings: AppSettings = {
  accentColor: "#57ffb8",
  matrixRain: "full",
  reducedMotion: false
};

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function normalizeColor(value: unknown): string {
  if (typeof value !== "string") return defaultSettings.accentColor;
  const trimmed = value.trim();
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed.toLowerCase() : defaultSettings.accentColor;
}

function normalizeMatrixRain(value: unknown): AppSettings["matrixRain"] {
  return value === "subtle" || value === "off" ? value : "full";
}

function loadSettings(): AppSettings {
  try {
    const stored = window.localStorage.getItem(settingsStorageKey);
    if (!stored) return defaultSettings;
    const parsed = JSON.parse(stored) as Partial<AppSettings>;
    return {
      accentColor: normalizeColor(parsed.accentColor),
      matrixRain: normalizeMatrixRain(parsed.matrixRain),
      reducedMotion: Boolean(parsed.reducedMotion)
    };
  } catch {
    return defaultSettings;
  }
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

type Rgb = ReturnType<typeof hexToRgb>;

function rgbString(color: Rgb) {
  return `${color.r} ${color.g} ${color.b}`;
}

function cssRgb(color: Rgb) {
  return `rgb(${rgbString(color)})`;
}

function mixWithWhite(color: Rgb, amount: number): Rgb {
  return {
    r: Math.round(color.r + (255 - color.r) * amount),
    g: Math.round(color.g + (255 - color.g) * amount),
    b: Math.round(color.b + (255 - color.b) * amount)
  };
}

function scale(color: Rgb, amount: number): Rgb {
  return {
    r: Math.round(color.r * amount),
    g: Math.round(color.g * amount),
    b: Math.round(color.b * amount)
  };
}

function relativeLuminance(color: Rgb) {
  const linear = [color.r, color.g, color.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function applyAccentColor(accentColor: string) {
  const accent = hexToRgb(accentColor);
  const accentOn = relativeLuminance(accent) > 0.42 ? { r: 8, g: 8, b: 8 } : { r: 250, g: 250, b: 250 };
  const strong = mixWithWhite(accent, 0.78);
  const warm = accentColor === defaultSettings.accentColor ? { r: 200, g: 255, b: 100 } : mixWithWhite(accent, 0.48);
  const root = document.documentElement;
  root.style.setProperty("--accent", accentColor);
  root.style.setProperty("--accent-rgb", rgbString(accent));
  root.style.setProperty("--accent-on", cssRgb(accentOn));
  root.style.setProperty("--accent-on-rgb", rgbString(accentOn));
  root.style.setProperty("--accent-strong", cssRgb(strong));
  root.style.setProperty("--accent-soft", `rgb(${rgbString(accent)} / 0.13)`);
  root.style.setProperty("--line", `rgb(${rgbString(accent)} / 0.42)`);
  root.style.setProperty("--line-soft", `rgb(${rgbString(accent)} / 0.18)`);
  root.style.setProperty("--ink", cssRgb(mixWithWhite(accent, 0.72)));
  root.style.setProperty("--ink-strong", cssRgb(mixWithWhite(accent, 0.9)));
  root.style.setProperty("--muted", cssRgb(mixWithWhite(accent, 0.34)));
  root.style.setProperty("--muted-2", cssRgb(mixWithWhite(accent, 0.16)));
  root.style.setProperty("--warm-rgb", rgbString(warm));
  root.style.setProperty("--warm", cssRgb(warm));
  root.style.setProperty("--warm-soft", `rgb(${rgbString(warm)} / 0.12)`);
  root.style.setProperty("--bg-grid", cssRgb(scale(accent, 0.025)));
  root.style.setProperty("--top-nav-rgb", rgbString(scale(accent, 0.04)));
  root.style.setProperty("--field-rgb", rgbString(scale(accent, 0.045)));
  root.style.setProperty("--surface-rgb", rgbString(scale(accent, 0.07)));
  root.style.setProperty("--surface-solid-rgb", rgbString(scale(accent, 0.09)));
  root.style.setProperty("--surface-2-rgb", rgbString(scale(accent, 0.13)));
  root.style.setProperty("--surface-3-rgb", rgbString(scale(accent, 0.19)));
  root.style.setProperty("--panel-rgb", rgbString(scale(accent, 0.075)));
  root.style.setProperty("--surface", `rgb(${rgbString(scale(accent, 0.07))} / 0.86)`);
  root.style.setProperty("--surface-solid", cssRgb(scale(accent, 0.09)));
  root.style.setProperty("--surface-2", cssRgb(scale(accent, 0.13)));
  root.style.setProperty("--surface-3", cssRgb(scale(accent, 0.19)));
  root.style.setProperty("--shadow", `0 0 22px rgb(${rgbString(accent)} / 0.14), inset 0 0 38px rgb(${rgbString(accent)} / 0.04)`);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  useLayoutEffect(() => {
    applyAccentColor(settings.accentColor);
    window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
  }, [settings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      updateSettings: (patch) =>
        setSettings((current) => ({
          ...current,
          ...patch,
          accentColor: patch.accentColor ? normalizeColor(patch.accentColor) : current.accentColor,
          matrixRain: patch.matrixRain ? normalizeMatrixRain(patch.matrixRain) : current.matrixRain
        })),
      resetSettings: () => setSettings(defaultSettings)
    }),
    [settings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used inside SettingsProvider.");
  return context;
}
