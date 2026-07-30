import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "../App";
import { SteamSettingsProvider } from "./settings";

function renderApp() {
  render(
    <SteamSettingsProvider>
      <MemoryRouter><App /></MemoryRouter>
    </SteamSettingsProvider>
  );
}

afterEach(() => window.localStorage.clear());

describe("Steam client feature settings", () => {
  it("hides the Network tab by default", () => {
    window.localStorage.clear();
    renderApp();
    expect(screen.queryByRole("link", { name: "Network" })).not.toBeInTheDocument();
  });

  it("shows the Network tab when explicitly enabled", () => {
    window.localStorage.setItem("rolodexian.steam-settings.v1", JSON.stringify({
      reducedMotion: false,
      networkEnabled: true
    }));
    renderApp();
    expect(screen.getByRole("link", { name: "Network" })).toBeInTheDocument();
  });
});
