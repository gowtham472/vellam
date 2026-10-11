import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/noto-sans-tamil';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';

const root = document.getElementById('root');
if (root === null) throw new Error('The page has no root element');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
