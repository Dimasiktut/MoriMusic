
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Global error listener to debug issues in TWA and satisfy TS rules
window.onerror = (message, _source, _lineno, _colno, _error) => {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="color:#ef4444; padding:40px; text-align:center; font-family:sans-serif; background:#000; height:100vh; display:flex; flex-direction:column; justify-content:center;">
        <h2 style="font-weight:900; font-style:italic;">SYSTEM ERROR</h2>
        <p style="font-size:12px; margin-top:10px; opacity:0.6;">${String(message)}</p>
        <button onclick="window.location.reload()" style="margin-top:30px; background:#ef4444; color:white; border:none; padding:12px 24px; border-radius:12px; font-weight:900; text-transform:uppercase;">Retry</button>
      </div>
    `;
  }
  return false;
};

const initTelegram = () => {
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor) {
        tg.setHeaderColor('#000000');
      }
      if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
    }
  } catch (e) {
    console.error("Telegram WebApp initialization error:", e);
  }
};

const renderApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Critical render error:", error);
    rootElement.innerHTML = `
      <div style="color:white; padding:40px; text-align:center; font-family:sans-serif; background:#000; height:100vh; display:flex; flex-direction:column; justify-content:center;">
        <h2 style="color:#38bdf8; font-weight:900; font-style:italic;">BOOT ERROR</h2>
        <p style="font-size:11px; color:#666; margin-top:20px; font-family:monospace;">${String(error)}</p>
        <button onclick="window.location.reload()" style="margin-top:20px; background:#38bdf8; border:none; padding:12px 24px; border-radius:12px; font-weight:900; color:black; text-transform:uppercase;">Reload</button>
      </div>
    `;
  }
};

// Start initialization
initTelegram();

// Small timeout to ensure the DOM and TWA environment are fully ready
if (document.readyState === 'complete') {
  renderApp();
} else {
  window.addEventListener('load', renderApp);
}
