import React from "react";
import ReactDOM from "react-dom/client";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import App from "./App";
import DirectoryPage from "./pages/DirectoryPage";
import ProfilePage from "./pages/ProfilePage";
import ContactEditPage from "./pages/ContactEditPage";
import ContactsImportExportPage from "./pages/ContactsImportExportPage";
import GraphPage from "./pages/GraphPage";
import SettingsPage from "./pages/SettingsPage";
import { SteamSettingsProvider, useSteamSettings } from "./lib/settings";
import "./styles.css";

function NetworkRoute() {
  const { settings } = useSteamSettings();
  return settings.networkEnabled ? <GraphPage /> : <Navigate to="/settings" replace />;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <DirectoryPage /> },
      { path: "contacts/new", element: <ContactEditPage /> },
      { path: "contacts/:id", element: <ProfilePage /> },
      { path: "contacts/:id/edit", element: <ContactEditPage /> },
      { path: "contacts/import-export", element: <ContactsImportExportPage /> },
      { path: "graph", element: <NetworkRoute /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <Navigate to="/" replace /> }
    ]
  }
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SteamSettingsProvider><RouterProvider router={router} /></SteamSettingsProvider>
  </React.StrictMode>
);
