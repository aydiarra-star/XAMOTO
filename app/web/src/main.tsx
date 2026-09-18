import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { I18nProvider } from './i18n';
import { AuthProvider } from './auth';
import { VehicleProvider } from './vehicle-context';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Élément #root introuvable');

/**
 * Mode hors ligne (§22) : la coquille de l'interface est mise en cache, jamais
 * les réponses d'API. En développement, le service worker est désactivé pour
 * éviter de servir une interface périmée.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* l'application reste pleinement utilisable sans service worker */
    });
  });
}

createRoot(container).render(
  <React.StrictMode>
    <I18nProvider>
      <AuthProvider>
        <VehicleProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </VehicleProvider>
      </AuthProvider>
    </I18nProvider>
  </React.StrictMode>,
);
