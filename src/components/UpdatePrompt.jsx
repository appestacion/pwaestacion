// src/components/UpdatePrompt.jsx
import { useEffect, useRef, useState } from 'react';
import { Snackbar, Alert, Button } from '@mui/material';

export default function UpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const registrationRef = useRef(null);

  useEffect(() => {
    // ─────────────────────────────────────────────────────────────
    // Solo registramos el SW en PRODUCCIÓN.
    // En dev (npm run dev / netlify dev) no existe /sw.js (vite-plugin-pwa
    // solo lo genera en build), y el fallback SPA sirve index.html con
    // MIME text/html, lo que rompe el registro con SecurityError.
    // ─────────────────────────────────────────────────────────────
    if (!import.meta.env.PROD) {
      console.log('[PWA] Modo desarrollo: SW no registrado (comportamiento normal).');
      return;
    }

    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;
    const notifiedWorkers = new WeakSet();

    const handleInstalled = (worker) => {
      if (worker.state !== 'installed') return;

      // Si ya notificamos este worker, no hacer nada (evita logs duplicados).
      if (notifiedWorkers.has(worker)) return;
      notifiedWorkers.add(worker);

      if (navigator.serviceWorker.controller) {
        // Hay un SW activo controlando la página → es una actualización.
        console.log('[PWA] Nueva versión disponible.');
        setUpdateAvailable(true);
      } else {
        // No hay SW previo → primera instalación correcta.
        console.log('[PWA] App lista para usar sin conexión.');
      }
    };

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        if (cancelled) return;
        registrationRef.current = reg;

        // Si al montar ya hay un SW en waiting (p.ej. update previa sin
        // aceptar), mostramos el snackbar inmediatamente.
        if (reg.waiting && navigator.serviceWorker.controller) {
          console.log('[PWA] Nueva versión disponible.');
          setUpdateAvailable(true);
        }

        // Listener único para nuevos updatefound → instalados.
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            handleInstalled(newWorker);
          });
        });
      } catch (err) {
        console.error('[PWA] Error registrando Service Worker:', err);
      }
    };

    register();

    // Cuando el nuevo SW toma el control (tras SKIP_WAITING), recargamos.
    const onControllerChange = () => {
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const handleReload = () => {
    const reg = registrationRef.current;
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // Fallback: si por algún motivo no tenemos el waiting, recargamos directo.
      window.location.reload();
    }
  };

  return (
    <Snackbar
      open={updateAvailable}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ bottom: { xs: 80, sm: 24 } }}
    >
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={handleReload}>
            Recargar
          </Button>
        }
      >
        Nueva versión disponible
      </Alert>
    </Snackbar>
  );
}