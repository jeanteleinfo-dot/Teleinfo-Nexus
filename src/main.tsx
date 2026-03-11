import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

console.log("Nexus Platform: Initializing...");

window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global Error Caught:", message, error);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<div style="padding: 20px; color: #ef4444; font-family: sans-serif;">
      <h1 style="font-size: 18px; font-weight: bold;">Erro de Inicialização</h1>
      <p style="font-size: 14px; opacity: 0.8;">${message}</p>
      <button onclick="window.location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer;">Recarregar</button>
    </div>`;
  }
  return false;
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Nexus Platform: Root element not found!");
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  console.log("Nexus Platform: Rendering...");
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("Nexus Platform: Render called.");
} catch (error) {
  console.error("Nexus Platform: Render failed!", error);
}
