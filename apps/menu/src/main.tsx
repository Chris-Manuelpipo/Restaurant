import { StrictMode, type JSX } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';
import { MenuPage } from './routes/MenuPage';
import { Landing } from './routes/Landing';
import { useRoute } from './lib/router';
import { loadBodyFont } from './lib/fonts';

/**
 * Point d'entrée du menu client.
 *
 * Volontairement dépouillé : chaque kilo-octet ici retarde l'apparition de la carte sur le
 * téléphone d'un client debout dans une salle. Voir docs/PERFORMANCE.md.
 */
function App(): JSX.Element {
  const route = useRoute();
  return route.slug ? <MenuPage route={route} /> : <Landing />;
}

// La police de corps part après le premier rendu, quand le réseau s'est libéré.
void loadBodyFont();

/**
 * Le service worker s'installe une fois la page chargée. C'est lui qui rendra la carte
 * consultable hors ligne — mais au premier scan, l'urgence est d'afficher le menu.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    setTimeout(() => void navigator.serviceWorker.register('/sw.js'), 1500);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
