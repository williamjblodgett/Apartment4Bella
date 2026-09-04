import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ApartmentFinder from "../app/page";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) throw new Error("Missing application root");

createRoot(root).render(
  <StrictMode>
    <ApartmentFinder />
  </StrictMode>,
);
