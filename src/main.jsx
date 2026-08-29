import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import BoardView from "./pages/BoardView.jsx";
import "./styles.css";

const isBoard = window.location.pathname.startsWith("/board");

createRoot(document.getElementById("root")).render(
  <React.StrictMode>{isBoard ? <BoardView /> : <App />}</React.StrictMode>,
);
