// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// ── ErrorBoundary: evita pantalla blanca si un componente falla ──
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary capturó:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearCache = () => {
    if (window.forceReload) {
      window.forceReload();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'Inter, system-ui, sans-serif',
          backgroundColor: '#F5F5F5',
        }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>&#9888;&#65039;</div>
          <h2 style={{ color: '#CE1126', marginBottom: 8, fontSize: 20 }}>Error en la aplicación</h2>
          <p style={{ color: '#666', textAlign: 'center', marginBottom: 24, fontSize: 14, maxWidth: 320 }}>
            Ocurrió un error inesperado. Esto puede deberse a una conexión interrumpida o a una versión antigua en caché.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={this.handleClearCache}
              style={{
                padding: '12px 24px',
                backgroundColor: '#CE1126',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Borrar caché y recargar
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: '12px 24px',
                backgroundColor: '#666',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Recargar
            </button>
          </div>
          <p style={{ color: '#999', marginTop: 16, fontSize: 11 }}>
            Si el problema persiste, borre los datos del sitio en la configuración del navegador.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── PWA: Capturar prompt de instalacion para uso futuro ──
// FIX: NO interceptamos preventDefault() ni llamamos prompt() automaticamente.
// El prompt() SOLO funciona con un gesto del usuario (clic/tap).
// Guardamos el evento para que un componente de UI pueda llamarlo
// cuando el usuario haga clic en un boton "Instalar App".
window.__deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  // Guardar el evento SIN llamar preventDefault()
  // El navegador puede seguir mostrando su banner nativo si lo desea
  window.__deferredInstallPrompt = e;
  console.log('[PWA] Prompt de instalacion disponible para usar via boton');
});

// ── Capturar errores globales que no llegan a React ──
window.addEventListener('error', (event) => {
  console.error('Error global:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Promise rechazada sin manejar:', event.reason);
});

// ── Ocultar el loader inicial de index.html cuando React monte ──
// Esto garantiza que el spinner inline desaparezca una vez que la app carga correctamente
function hideInitialLoader() {
  const loader = document.getElementById('initial-loader');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => {
      loader.remove();
    }, 300);
  }
  // FIX: Señal para el timeout de index.html de que la app montó correctamente
  window.__APP_MOUNTED = true;
}

// ── Montar la aplicación ──
ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </ErrorBoundary>
);

// Ocultar el loader inmediatamente después de montar React
// Usamos requestAnimationFrame para asegurar que el DOM ya fue pintado
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    hideInitialLoader();
  });
});
