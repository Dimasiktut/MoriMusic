
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Initialize Telegram WebApp correctly for mobile devices
const tg = (window as any).Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
