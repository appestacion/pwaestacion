// src/components/InstallPWA.jsx
// Banner de instalación PWA con instrucciones para Android e iOS.
// Se muestra automáticamente cuando la app NO está instalada.
// En Android usa beforeinstallprompt. En iOS muestra instrucciones manuales.

import React, { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Chip from '@mui/material/Chip';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import IosShareIcon from '@mui/icons-material/IosShare';
import AddToHomeScreenIcon from '@mui/icons-material/AddToHomeScreen';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import AndroidIcon from '@mui/icons-material/Android';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';

// Detectar si es iOS
const isIOS = () => {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua);
};

// Detectar si está en modo standalone (ya instalada)
const isStandalone = () => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator?.standalone === true;
};

// Detectar si es Safari en iOS
const isSafariIOS = () => {
  const ua = navigator.userAgent || '';
  return isIOS() && /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS/.test(ua);
};

export default function InstallPWA() {
  const [dismissed, setDismissed] = useState(false);
  const [showIOSDialog, setShowIOSDialog] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [showAndroidBanner, setShowAndroidBanner] = useState(false);

  useEffect(() => {
    // Si ya fue descartado o ya está instalada, no mostrar nada
    if (dismissed || isStandalone()) return;

    // Verificar si se descartó previamente (localStorage)
    const wasDismissed = localStorage.getItem('pwa-install-dismissed');
    if (wasDismissed) {
      const dismissedTime = parseInt(wasDismissed, 10);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      // Mostrar de nuevo después de 7 días
      if (Date.now() - dismissedTime < sevenDays) {
        setDismissed(true);
        return;
      }
    }

    if (isIOS()) {
      // En iOS mostrar el banner después de 3 segundos
      const timer = setTimeout(() => {
        setShowAndroidBanner(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // Android: escuchar beforeinstallprompt
    const handler = (e) => {
      // No llamamos preventDefault() para permitir el prompt nativo del navegador
      setCanInstall(true);
      // Mostrar banner después de 2 segundos
      setTimeout(() => {
        setShowAndroidBanner(true);
      }, 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Verificar si ya hay un prompt guardado (por main.jsx)
    if (window.__deferredInstallPrompt) {
      setCanInstall(true);
      setTimeout(() => {
        setShowAndroidBanner(true);
      }, 2000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [dismissed]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setShowAndroidBanner(false);
    localStorage.setItem('pwa-install-dismissed', String(Date.now()));
  }, []);

  const handleInstallAndroid = useCallback(async () => {
    const promptEvent = window.__deferredInstallPrompt;
    if (!promptEvent) {
      // Fallback: recargar para que el navegador muestre su prompt nativo
      setShowAndroidBanner(false);
      return;
    }
    try {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        console.log('[PWA] Usuario aceptó instalar');
      }
      window.__deferredInstallPrompt = null;
      setCanInstall(false);
    } catch (err) {
      console.error('[PWA] Error al instalar:', err);
    }
    setShowAndroidBanner(false);
  }, []);

  const handleShowIOSInstructions = useCallback(() => {
    setShowIOSDialog(true);
  }, []);

  // No mostrar si está instalada o descartada
  if (isStandalone() || dismissed || !showAndroidBanner) return null;

  // ── Banner principal ──
  const renderBanner = () => {
    const ios = isIOS();

    return (
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          borderRadius: '16px 16px 0 0',
          overflow: 'hidden',
          borderTop: '3px solid #CE1126',
        }}
      >
        {/* Botón cerrar */}
        <Box sx={{ position: 'absolute', top: 4, right: 4, zIndex: 1 }}>
          <IconButton size="small" onClick={handleDismiss} sx={{ color: 'grey.500' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ p: 2, pr: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Icono de la app */}
            <Box
              component="img"
              src="/icons/icon-192.png"
              alt="Montaña Fresca"
              sx={{ width: 48, height: 48, borderRadius: 2, flexShrink: 0 }}
            />

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#CE1126' }}>
                  Instalar App
                </Typography>
                <Chip
                  icon={ios ? <PhoneIphoneIcon sx={{ fontSize: '14px !important' }} /> : <AndroidIcon sx={{ fontSize: '14px !important' }} />}
                  label={ios ? 'iOS' : 'Android'}
                  size="small"
                  sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.3 }}>
                Accede más rápido desde tu pantalla de inicio
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
            {ios ? (
              <Button
                variant="contained"
                fullWidth
                startIcon={<IosShareIcon />}
                onClick={handleShowIOSInstructions}
                sx={{
                  bgcolor: '#CE1126',
                  '&:hover': { bgcolor: '#a50e1f' },
                  fontWeight: 700,
                  borderRadius: 2,
                  textTransform: 'none',
                }}
              >
                Ver Instrucciones
              </Button>
            ) : canInstall ? (
              <Button
                variant="contained"
                fullWidth
                startIcon={<DownloadIcon />}
                onClick={handleInstallAndroid}
                sx={{
                  bgcolor: '#CE1126',
                  '&:hover': { bgcolor: '#a50e1f' },
                  fontWeight: 700,
                  borderRadius: 2,
                  textTransform: 'none',
                }}
              >
                Instalar App
              </Button>
            ) : (
              <Button
                variant="contained"
                fullWidth
                startIcon={<AddToHomeScreenIcon />}
                onClick={() => setShowAndroidBanner(false)}
                sx={{
                  bgcolor: '#CE1126',
                  '&:hover': { bgcolor: '#a50e1f' },
                  fontWeight: 700,
                  borderRadius: 2,
                  textTransform: 'none',
                }}
              >
                Usar menú del navegador
              </Button>
            )}
            <Button
              variant="outlined"
              onClick={handleDismiss}
              sx={{
                fontWeight: 600,
                borderRadius: 2,
                textTransform: 'none',
                borderColor: '#ccc',
                color: 'text.secondary',
                minWidth: 80,
              }}
            >
              Ahora no
            </Button>
          </Box>
        </Box>
      </Paper>
    );
  };

  // ── Diálogo de instrucciones para iOS ──
  const renderIOSDialog = () => {
    return (
      <Dialog
        open={showIOSDialog}
        onClose={() => setShowIOSDialog(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 3, mx: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <PhoneIphoneIcon sx={{ color: '#CE1126' }} />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Instalar en iOS</Typography>
          </Box>
          <IconButton onClick={() => setShowIOSDialog(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          <Box
            component="img"
            src="/icons/icon-192.png"
            alt="Montaña Fresca"
            sx={{ width: 80, height: 80, borderRadius: 3, display: 'block', mx: 'auto', mb: 2 }}
          />

          <Typography variant="body2" sx={{ mb: 2, textAlign: 'center', color: 'text.secondary' }}>
            Para instalar <strong>E/S Montaña Fresca</strong> en tu iPhone o iPad, sigue estos pasos:
          </Typography>

          {isSafariIOS() ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Paso 1 */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderLeft: '4px solid #CE1126' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box sx={{
                    width: 32, height: 32, borderRadius: '50%', bgcolor: '#CE1126', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0,
                  }}>1</Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Toca el botón Compartir</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Presiona el ícono de compartir <IosShareIcon sx={{ fontSize: 14, verticalAlign: 'middle', mx: 0.5 }} />
                      ubicado en la parte inferior de la pantalla de Safari (barra de navegación).
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Paso 2 */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderLeft: '4px solid #CE1126' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box sx={{
                    width: 32, height: 32, borderRadius: '50%', bgcolor: '#CE1126', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0,
                  }}>2</Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Desplázate y busca "Agregar a inicio"</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      En el menú de compartir, desliza hacia abajo hasta encontrar la opción
                      <strong> "Agregar a inicio"</strong> (tiene el ícono de un + dentro de un cuadrado).
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Paso 3 */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderLeft: '4px solid #CE1126' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box sx={{
                    width: 32, height: 32, borderRadius: '50%', bgcolor: '#CE1126', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0,
                  }}>3</Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Toca "Agregar"</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Se abrirá una ventana de confirmación. Verifica que el nombre sea
                      <strong> "Montaña Fresca"</strong> y presiona el botón azul <strong>"Agregar"</strong>.
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Paso 4 */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderLeft: '4px solid #2E7D32' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box sx={{
                    width: 32, height: 32, borderRadius: '50%', bgcolor: '#2E7D32', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0,
                  }}>
                    <OpenInBrowserIcon sx={{ fontSize: 18 }} />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Importante: Abre desde Safari</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Esta opción solo está disponible en <strong>Safari</strong>.
                      Si estás en Chrome u otro navegador, abre esta página en Safari primero.
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Box>
          ) : (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <OpenInBrowserIcon sx={{ fontSize: 64, color: '#CE1126', mb: 2 }} />
              <Typography variant="body1" sx={{ fontWeight: 700, mb: 1 }}>
                Abre en Safari para instalar
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                La instalación de apps web en iOS solo funciona desde el navegador Safari.
                Copia el enlace de esta página y ábrela en Safari.
              </Typography>
              <Button
                variant="contained"
                startIcon={<OpenInBrowserIcon />}
                onClick={() => {
                  // Intentar abrir en Safari
                  window.location.href = `safari-http://${window.location.host}${window.location.pathname}`;
                }}
                sx={{ bgcolor: '#CE1126', '&:hover': { bgcolor: '#a50e1f' }, fontWeight: 700, borderRadius: 2 }}
              >
                Abrir en Safari
              </Button>
            </Box>
          )}

          <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
            <Typography variant="caption">
              Una vez instalada, la app aparecerá en tu pantalla de inicio como cualquier otra aplicación.
              Funciona sin conexión a internet y tiene acceso completo a todas las funciones.
            </Typography>
          </Alert>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setShowIOSDialog(false);
              handleDismiss();
            }}
            sx={{ fontWeight: 600, textTransform: 'none' }}
          >
            Entendido
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <>
      {renderBanner()}
      {renderIOSDialog()}
    </>
  );
}
