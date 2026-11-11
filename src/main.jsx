import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { applyTheme, readTheme, watchSystemTheme } from './lib/theme.js';
import './styles.css';

applyTheme(readTheme());
watchSystemTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
