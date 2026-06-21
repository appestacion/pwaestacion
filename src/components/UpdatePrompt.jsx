// src/components/UpdatePrompt.jsx
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Snackbar, Alert, Button } from '@mui/material';

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      // ─────────────────────────────────────────────────────────────
      // Chequeo periódico de actualizaciones cada hora.
      // El navegador por defecto solo chequea cada ~24h, lo cual es
      // demasiado lento para una app en producción con despliegues
      // frecuentes. Esto fuerza a buscar updates cada 60 min mientras
      // la pestaña esté abierta.
      // ─────────────────────────────────────────────────────────────
      if (r) {
        const interval = setInterval(() => {
          if (r.update) {
            r.update().catch(() => {});
          }
        }, 60 * 60 * 1000);
        // Limpiar el interval cuando el componente se desmonte.
        return () => clearInterval(interval);
      }
    },
    onRegisterError(error) {
      console.error('[PWA] Error registrando Service Worker:', error);
    },
  });

  const handleReload = () => {
    console.log('[PWA] Botón "Recargar" clickeado — iniciando actualización.');

    // ─────────────────────────────────────────────────────────────
    // Fallback duro: si después de 3 segundos la página no se ha
    // recargado (porque controllerchange no se disparó — p.ej. el
    // SW nuevo era idéntico al viejo o ya estaba activo), forzamos
    // el reload manualmente.
    // ─────────────────────────────────────────────────────────────
    let reloaded = false;
    const forceReload = () => {
      if (reloaded) return;
      reloaded = true;
      console.warn('[PWA] Forzando reload de la página.');
      window.location.reload();
    };
    const fallbackTimer = setTimeout(forceReload, 3000);

    // ─────────────────────────────────────────────────────────────
    // updateServiceWorker(true) hace lo siguiente internamente:
    //   1. postMessage({ type: 'SKIP_WAITING' }) al SW en waiting
    //   2. Espera al evento 'controllerchange'
    //   3. Llama a window.location.reload()
    // ─────────────────────────────────────────────────────────────
    updateServiceWorker(true)
      .then(() => {
        // Si llegamos aquí sin recargar (raro), forzamos reload.
        clearTimeout(fallbackTimer);
        if (!reloaded) {
          forceReload();
        }
      })
      .catch((err) => {
        console.error('[PWA] updateServiceWorker falló:', err);
        clearTimeout(fallbackTimer);
        forceReload();
      });
  };

  const handleClose = () => {
    // Permite al usuario cerrar el snackbar sin actualizar.
    // Volverá a aparecer en el próximo chequeo periódico.
    setNeedRefresh(false);
  };

  return (
    <Snackbar
      open={needRefresh}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{
        bottom: { xs: 80, sm: 24 },
        // Asegurar z-index mayor que notistack (1400) para que el
        // botón siempre reciba clicks.
        zIndex: 2000,
      }}
    >
      <Alert
        severity="error"
        action={
          <Button
            color="inherit"
            size="small"
            onClick={handleReload}
            sx={{ fontWeight: 700 }}
          >
            Recargar
          </Button>
        }
        onClose={handleClose}
      >
        Nueva versión disponible
      </Alert>
    </Snackbar>
  );
}