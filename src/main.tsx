import React from "react";
import ReactDOM from "react-dom/client";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import App from "./App";
import ContactsImportExportPage from "./pages/ContactsImportExportPage";
import ContactsPage from "./pages/ContactsPage";
import ContactDetailPage from "./pages/ContactDetailPage";
import ContactEditPage from "./pages/ContactEditPage";
import GraphPage from "./pages/GraphPage";
import SettingsPage from "./pages/SettingsPage";
import { SettingsProvider } from "./lib/settings";
import "./styles.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <ContactsPage /> },
      { path: "contacts/import-export", element: <ContactsImportExportPage /> },
      { path: "contacts/new", element: <ContactEditPage /> },
      { path: "contacts/:id", element: <ContactDetailPage /> },
      { path: "contacts/:id/edit", element: <ContactEditPage /> },
      { path: "graph", element: <GraphPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <Navigate to="/" replace /> }
    ]
  }
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SettingsProvider>
      <RouterProvider router={router} />
    </SettingsProvider>
  </React.StrictMode>
);
