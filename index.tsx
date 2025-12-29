
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
      // Сообщаем платформе, что приложение готово к отрисовке
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
      <div style="color:white; padding:40px; text-align:center; font-family:sans-serif; background:#000; height:100vh;">
        <h2 style="color:#38bdf8">Mori Startup Error</h2>
        <p style="font-size:12px; color:#666; margin-top:20px;">${String(error)}</p>
        <button onclick="window.location.reload()" style="margin-top:20px; background:#38bdf8; border:none; padding:10px 20px; border-radius:10px; font-weight:bold;">Reload</button>
      </div>
    `;
  }
};

// Запуск
initTelegram();
// Используем setTimeout, чтобы гарантировать готовность DOM в среде Telegram
setTimeout(renderApp, 0);
