
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const initTelegram = () => {
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor) {
        tg.setHeaderColor('#000000');
      }
    }
  } catch (e) {
    console.error("Telegram WebApp initialization error:", e);
  }
};

initTelegram();

const rootElement = document.getElementById('root');
if (rootElement) {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Critical render error:", error);
    rootElement.innerHTML = `<div style="color:red; padding:20px;">Startup Error: ${String(error)}</div>`;
  }
}
