import React from "react";
import "./amplify-config"; // Configure Amplify before anything else
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
