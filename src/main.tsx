import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/palettes.css";
import "./styles/theme-ivoire-chaud.css";

createRoot(document.getElementById("root")!).render(<App />);
