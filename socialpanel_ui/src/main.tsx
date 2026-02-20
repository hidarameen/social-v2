
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  const rootHtml = document.documentElement;
  if (rootHtml.classList.contains("preload")) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        rootHtml.classList.remove("preload");
      });
    });
  }

  createRoot(document.getElementById("root")!).render(<App />);
  
