import React from "react";
import ReactDOM from "react-dom/client";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import App from "./App";
import ContactsPage from "./pages/ContactsPage";
import ContactDetailPage from "./pages/ContactDetailPage";
import ContactEditPage from "./pages/ContactEditPage";
import GraphPage from "./pages/GraphPage";
import "./styles.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <ContactsPage /> },
      { path: "contacts/new", element: <ContactEditPage /> },
      { path: "contacts/:id", element: <ContactDetailPage /> },
      { path: "contacts/:id/edit", element: <ContactEditPage /> },
      { path: "graph", element: <GraphPage /> },
      { path: "*", element: <Navigate to="/" replace /> }
    ]
  }
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
