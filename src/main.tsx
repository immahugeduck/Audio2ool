import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent third-party cross-origin iframe SecurityError from crashing preview
window.addEventListener('error', (event) => {
  if (
    event.message?.includes('SecurityError') ||
    event.message?.includes('cross-origin') ||
    event.message?.includes('$$typeof') ||
    event.message?.includes('Should not already be working')
  ) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.message || String(event.reason || '');
  if (
    reason.includes('SecurityError') ||
    reason.includes('cross-origin') ||
    reason.includes('$$typeof')
  ) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

