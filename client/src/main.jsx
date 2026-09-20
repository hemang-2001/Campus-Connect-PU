import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles/global.css';

import App from './App';
import { AuthProvider } from './context/AuthContext';
import { registerSW } from './registerServiceWorker';

// Register PWA Service Worker
registerSW();


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
