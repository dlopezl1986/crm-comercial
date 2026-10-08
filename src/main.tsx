import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { isFirebaseConfigured } from '@/config/firebase.config';
import { App } from '@/app/App';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/layout.css';
import '@/styles/dashboard.css';

const root = createRoot(document.getElementById('root')!);

if (!isFirebaseConfigured) {
  root.render(
    <div className="center-screen">
      <div className="card" style={{ maxWidth: 460 }}>
        <h2>Falta la configuración de Firebase</h2>
        <p className="muted">Completa <code>src/config/firebase.config.ts</code> con los datos de la app web de tu proyecto Firebase.</p>
      </div>
    </div>,
  );
} else {
  root.render(<StrictMode><App /></StrictMode>);
}
