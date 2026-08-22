import React from 'react';
import ReactDOM from 'react-dom/client';
import App 'App';
import { CasinoProvider } 'CasinoContext';
import './styles/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <CasinoProvider>
      <App />
    </CasinoProvider>
  </React.StrictMode>
);
