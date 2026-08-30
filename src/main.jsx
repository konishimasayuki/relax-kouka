import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import BoardView from "./pages/BoardView.jsx";
import SignageCongestion from "./pages/SignageCongestion.jsx";
import SignagePromo from "./pages/SignagePromo.jsx";
import "./styles.css";

const path = window.location.pathname;
let Page = App;
if (path.startsWith("/board")) Page = BoardView;
else if (path.startsWith("/signage-congestion")) Page = SignageCongestion;
else if (path.startsWith("/signage-promo")) Page = SignagePromo;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>,
);
