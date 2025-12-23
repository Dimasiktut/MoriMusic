
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/**
 * Robust Telegram WebApp Initialization
 * We initialize the Telegram WebApp as early as possible and wrap it in a 
 * try-catch to ensure that any failure in the TG API doesn't block our app.
 */
const initTelegram = () => {
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      // Apply theme-consistent header color
      if (tg.setHeaderColor) {
        tg.setHeaderColor('#000000');
      }
    }
  } catch (e) {
    console.error("Telegram WebApp initialization error:", e);
  }
};

// Execute initialization
initTelegram();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

/**
 * We wrap the render call in a try-catch and use a fallback mechanism 
 * to provide feedback if a critical error occurs during the startup phase,
 * which is a common cause for 'black screens' on mobile.
 */
try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error("Failed to render the application:", error);
  rootElement.innerHTML = `
    <div style="
      background-color: #000; 
      color: #38bdf8; 
      height: 100vh; 
      display: flex; 
      flex-direction: column; 
      align-items: center; 
      justify-content: center; 
      font-family: sans-serif;
      text-align: center;
      padding: 20px;
    ">
      <h1 style="font-style: italic; font-weight: 900; margin-bottom: 10px;">MORI MUSIC</h1>
      <p style="color: #666; font-size: 14px;">Failed to initialize application.</p>
      <button onclick="window.location.reload()" style="
        margin-top: 20px;
        background: #38bdf8;
        color: #000;
        border: none;
        padding: 12px 24px;
        border-radius: 12px;
        font-weight: bold;
        text-transform: uppercase;
      ">Reload App</button>
    </div>
  `;
}
