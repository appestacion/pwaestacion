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
          <div style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: '#CE1126', marginBottom: 8, fontSize: 20 }}>Error en la aplicación</h2>
          <p style={{ color: '#666', textAlign: 'center', marginBottom: 24, fontSize: 14, maxWidth: 320 }}>
            Ocurrió un error inesperado. Esto puede deberse a una conexión interrumpida.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '12px 32px',
              backgroundColor: '#CE1126',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Recargar
          </button>
          <p style={{ color: '#999', marginTop: 16, fontSize: 11 }}>
            Si el problema persiste, borra los datos del sitio en la configuración del navegador.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Capturar errores globales que no llegan a React ──
window.addEventListener('error', (event) => {
  console.error('Error global:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Promise rechazada sin manejar:', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </ErrorBoundary>
);