import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAntiTamper } from "./lib/antiTamper";

initAntiTamper();

createRoot(document.getElementById("root")!).render(<App />);
