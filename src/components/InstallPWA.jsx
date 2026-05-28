// src/components/InstallPWA.jsx
// Banner de instalación PWA elegante y responsive.
// - PC: Barra compacta fija abajo (no tapa todo el ancho)
// - Android: Banner expandido centrado con animación slide-up
// - iOS: Banner compacto que abre dialog de instrucciones
// Se muestra automáticamente cuando la app NO está instalada.
// FIX: cleanup del event listener corregido (antes era timer._handler = undefined)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Slide from '@mui/material/Slide';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import IosShareIcon from '@mui/icons-material/IosShare';
import AddToHomeScreenIcon from '@mui/icons-material/AddToHomeScreen';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import AndroidIcon from '@mui/icons-material/Android';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';

const isIOS = () => {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua);
};

const isMobile = () => {
  const ua = navigator.userAgent || '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    (window.innerWidth <= 768);
};

const isStandalone = () => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator?.standalone === true;
};

const isSafariIOS = () => {
  const ua = navigator.userAgent || '';
  return isIOS() && /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS/.test(ua);
};

const SlideUp = React.forwardRef(function SlideUp(props, ref) {
  return <Slide {...props} direction="up" ref={ref} />;
});

export default function InstallPWA() {
  const [dismissed, setDismissed] = useState(false);
  const [showIOSDialog, setShowIOSDialog] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [visible, setVisible] = useState(false);
  const mobile = typeof window !== 'undefined' ? isMobile() : false;

  const installHandlerRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (dismissed || isStandalone()) return;

    const wasDismissed = localStorage.getItem('pwa-install-dismissed');
    if (wasDismissed) {
      const dismissedTime = parseInt(wasDismissed, 10);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < sevenDays) {
        setDismissed(true);
        return;
      }
    }

    const scheduleShow = () => {
      timerRef.current = setTimeout(() => {
        setShowBanner(true);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setVisible(true));
        });
      }, isIOS() ? 3000 : 2000);
    };

    if (isIOS()) {
      scheduleShow();
    } else {
      const handler = (e) => {
        setCanInstall(true);
        scheduleShow();
      };

      installHandlerRef.current = handler;
      window.addEventListener('beforeinstallprompt', handler);

      if (window.__deferredInstallPrompt) {
        setCanInstall(true);
        scheduleShow();
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (installHandlerRef.current) {
        window.removeEventListener('beforeinstallprompt', installHandlerRef.current);
      }
    };
  }, [dismissed]);

  useEffect(() => {
    const handler = () => {
      setShowBanner(false);
      setVisible(false);
    };
    window.addEventListener('appinstalled', handler);
    return () => window.removeEventListener('appinstalled', handler);
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setShowBanner(false);
      setDismissed(true);
      localStorage.setItem('pwa-install-dismissed', String(Date.now()));
    }, 300);
  }, []);

  const handleInstall = useCallback(async () => {
    const promptEvent = window.__deferredInstallPrompt;
    if (!promptEvent) {
      setShowBanner(false);
      setVisible(false);
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
    setVisible(false);
    setTimeout(() => setShowBanner(false), 300);
  }, []);

  const handleShowIOSInstructions = useCallback(() => {
    setShowIOSDialog(true);
  }, []);

  if (isStandalone() || dismissed || !showBanner) return null;

  const ios = isIOS();

  if (mobile) {
    return (
      <>
        <SlideUp in={visible} mountOnEnter unmountOnExit>
          <Box
            sx={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              display: 'flex',
              justifyContent: 'center',
              px: 3,
              pb: 2,
              pt: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            <Paper
              elevation={16}
              sx={{
                width: 340,
                maxWidth: '88%',
                borderRadius: 3.5,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'rgba(0,0,0,0.06)',
                background: 'linear-gradient(160deg, #FFFFFF 0%, #F8F9FA 100%)',
                position: 'relative',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              <Box
                sx={{
                  height: 3,
                  background: 'linear-gradient(90deg, #CE1126 0%, #E84855 50%, #CE1126 100%)',
                }}
              />

              <Tooltip title="No mostrar de nuevo">
                <IconButton
                  size="small"
                  onClick={handleDismiss}
                  sx={{
                    position: 'absolute',
                    top: 12,
                    right: 10,
                    zIndex: 1,
                    color: 'text.disabled',
                    '&:hover': { color: 'text.secondary', bgcolor: 'rgba(0,0,0,0.04)' },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>

              <Box sx={{ px: 2, pt: 2, pb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    component="img"
                    src="/icons/icon-192.png"
                    alt="Montaña Fresca"
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2.5,
                      flexShrink: 0,
                      boxShadow: '0 2px 10px rgba(206,17,38,0.18)',
                    }}
                  />

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}
                      >
                        Instalar App
                      </Typography>
                      <Chip
                        icon={ios
                          ? <PhoneIphoneIcon sx={{ fontSize: '11px !important' }} />
                          : <AndroidIcon sx={{ fontSize: '11px !important' }} />
                        }
                        label={ios ? 'iOS' : 'Android'}
                        size="small"
                        variant="outlined"
                        sx={{
                          height: 18,
                          fontSize: '0.58rem',
                          fontWeight: 600,
                          borderColor: 'rgba(206,17,38,0.25)',
                          color: '#CE1126',
                          '& .MuiChip-icon': { color: '#CE1126' },
                        }}
                      />
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block', mt: 0.25, lineHeight: 1.3 }}
                    >
                      Acceso rápido desde tu pantalla de inicio
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                  {ios ? (
                    <Button
                      variant="contained"
                      size="small"
                      fullWidth
                      startIcon={<IosShareIcon sx={{ fontSize: 17 }} />}
                      onClick={handleShowIOSInstructions}
                      sx={{
                        bgcolor: '#CE1126',
                        '&:hover': { bgcolor: '#a50e1f' },
                        fontWeight: 600,
                        borderRadius: 2,
                        textTransform: 'none',
                        fontSize: '0.78rem',
                        py: 0.65,
                        boxShadow: '0 2px 8px rgba(206,17,38,0.2)',
                      }}
                    >
                      Cómo instalar
                    </Button>
                  ) : canInstall ? (
                    <Button
                      variant="contained"
                      size="small"
                      fullWidth
                      startIcon={<DownloadIcon sx={{ fontSize: 17 }} />}
                      onClick={handleInstall}
                      sx={{
                        bgcolor: '#CE1126',
                        '&:hover': { bgcolor: '#a50e1f' },
                        fontWeight: 600,
                        borderRadius: 2,
                        textTransform: 'none',
                        fontSize: '0.78rem',
                        py: 0.65,
                        boxShadow: '0 2px 8px rgba(206,17,38,0.2)',
                      }}
                    >
                      Instalar App
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      size="small"
                      fullWidth
                      startIcon={<AddToHomeScreenIcon sx={{ fontSize: 17 }} />}
                      onClick={() => {
                        setVisible(false);
                        setTimeout(() => setShowBanner(false), 300);
                      }}
                      sx={{
                        bgcolor: '#CE1126',
                        '&:hover': { bgcolor: '#a50e1f' },
                        fontWeight: 600,
                        borderRadius: 2,
                        textTransform: 'none',
                        fontSize: '0.78rem',
                        py: 0.65,
                        boxShadow: '0 2px 8px rgba(206,17,38,0.2)',
                      }}
                    >
                      Menú (⋯) → Instalar
                    </Button>
                  )}
                  <Button
                    variant="text"
                    size="small"
                    onClick={handleDismiss}
                    sx={{
                      fontWeight: 500,
                      textTransform: 'none',
                      fontSize: '0.72rem',
                      color: 'text.disabled',
                      minWidth: 'unset',
                      px: 1.5,
                      '&:hover': { color: 'text.secondary', bgcolor: 'transparent' },
                    }}
                  >
                    Después
                  </Button>
                </Box>
              </Box>
            </Paper>
          </Box>
        </SlideUp>

        {renderIOSDialog(showIOSDialog, setShowIOSDialog, handleDismiss)}
      </>
    );
  }

  return (
    <SlideUp in={visible} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          pb: 2.5,
          pt: 1,
        }}
      >
        <Paper
          elevation={10}
          sx={{
            maxWidth: 480,
            width: 'auto',
            borderRadius: 3,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            background: '#FFFFFF',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.05)',
            '&:hover': {
              borderColor: 'rgba(206,17,38,0.15)',
              boxShadow: '0 8px 32px rgba(206,17,38,0.08), 0 2px 8px rgba(0,0,0,0.05)',
            },
            transition: 'all 0.2s ease',
          }}
        >
          <Box
            sx={{
              width: 3,
              height: '100%',
              minHeight: 52,
              bgcolor: '#CE1126',
              flexShrink: 0,
            }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1 }}>
            <Box
              component="img"
              src="/icons/icon-192.png"
              alt="Montaña Fresca"
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1.5,
                flexShrink: 0,
              }}
            />

            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2, fontSize: '0.82rem' }}
              >
                Instalar App
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.2, fontSize: '0.7rem' }}>
                Acceso rápido desde tu escritorio
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
              {canInstall ? (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<DownloadIcon sx={{ fontSize: 15 }} />}
                  onClick={handleInstall}
                  sx={{
                    bgcolor: '#CE1126',
                    '&:hover': { bgcolor: '#a50e1f' },
                    fontWeight: 600,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    py: 0.35,
                    px: 1.5,
                    boxShadow: '0 1px 4px rgba(206,17,38,0.15)',
                  }}
                >
                  Instalar
                </Button>
              ) : (
                <Tooltip title='Usa el menú del navegador (⋮) → "Instalar app"' arrow placement="top">
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddToHomeScreenIcon sx={{ fontSize: 15 }} />}
                    onClick={() => {
                      setVisible(false);
                      setTimeout(() => setShowBanner(false), 300);
                    }}
                    sx={{
                      bgcolor: '#CE1126',
                      '&:hover': { bgcolor: '#a50e1f' },
                      fontWeight: 600,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontSize: '0.75rem',
                      py: 0.35,
                      px: 1.5,
                      boxShadow: '0 1px 4px rgba(206,17,38,0.15)',
                    }}
                  >
                    Instalar
                  </Button>
                </Tooltip>
              )}

              <Box sx={{ width: 1, height: 20, bgcolor: 'divider', mx: 0.25 }} />

              <Tooltip title="No mostrar de nuevo">
                <IconButton
                  size="small"
                  onClick={handleDismiss}
                  sx={{
                    color: 'text.disabled',
                    p: 0.4,
                    '&:hover': { color: 'text.secondary', bgcolor: 'rgba(0,0,0,0.04)' },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Paper>
      </Box>
    </SlideUp>
  );
}

function renderIOSDialog(showIOSDialog, setShowIOSDialog, handleDismiss) {
  return (
    <Dialog
      open={showIOSDialog}
      onClose={() => setShowIOSDialog(false)}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 3.5, mx: 2, overflow: 'hidden' } }}
      TransitionComponent={SlideUp}
      TransitionProps={{ mountOnEnter: true }}
    >
      <Box
        sx={{
          px: 3,
          pt: 2.5,
          pb: 2,
          background: 'linear-gradient(135deg, #CE1126 0%, #E84855 100%)',
          color: '#fff',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              component="img"
              src="/icons/icon-192.png"
              alt="Montaña Fresca"
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2,
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}
            />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                Instalar en iPhone/iPad
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                E/S Montaña Fresca
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={() => setShowIOSDialog(false)}
            size="small"
            sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      <DialogContent sx={{ pt: 2.5, pb: 1 }}>
        {isSafariIOS() ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                p: 1.5,
                borderRadius: 2,
                bgcolor: '#FFF5F5',
                borderLeft: '3px solid #CE1126',
              }}
            >
              <Box sx={{
                width: 26, height: 26, borderRadius: '50%', bgcolor: '#CE1126', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '0.75rem', flexShrink: 0,
              }}>1</Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>Toca el botón Compartir</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.4 }}>
                  Presiona <IosShareIcon sx={{ fontSize: 14, verticalAlign: 'middle', mx: 0.3 }} /> en la barra inferior de Safari.
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                p: 1.5,
                borderRadius: 2,
                bgcolor: '#FFF5F5',
                borderLeft: '3px solid #CE1126',
              }}
            >
              <Box sx={{
                width: 26, height: 26, borderRadius: '50%', bgcolor: '#CE1126', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '0.75rem', flexShrink: 0,
              }}>2</Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>
                  Busca &quot;Agregar a inicio&quot;
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.4 }}>
                  Desliza el menú hacia abajo hasta encontrar <strong>&quot;Agregar a inicio&quot;</strong> (ícono + dentro de un cuadrado).
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                p: 1.5,
                borderRadius: 2,
                bgcolor: '#FFF5F5',
                borderLeft: '3px solid #CE1126',
              }}
            >
              <Box sx={{
                width: 26, height: 26, borderRadius: '50%', bgcolor: '#CE1126', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '0.75rem', flexShrink: 0,
              }}>3</Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>
                  Toca &quot;Agregar&quot;
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.4 }}>
                  Verifica el nombre <strong>&quot;Montaña Fresca&quot;</strong> y presiona el botón azul <strong>&quot;Agregar&quot;</strong>.
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                p: 1.5,
                borderRadius: 2,
                bgcolor: '#E8F5E9',
                borderLeft: '3px solid #2E7D32',
              }}
            >
              <Box sx={{
                width: 26, height: 26, borderRadius: '50%', bgcolor: '#2E7D32', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <OpenInBrowserIcon sx={{ fontSize: 15 }} />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>
                  Solo funciona en Safari
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.4 }}>
                  Si estás en Chrome u otro navegador, copia el enlace y ábrelo en Safari primero.
                </Typography>
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <OpenInBrowserIcon sx={{ fontSize: 52, color: '#CE1126', mb: 1.5, opacity: 0.7 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              Abre en Safari
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, px: 2 }}>
              La instalación de apps web en iOS solo funciona desde Safari. Copia el enlace de esta página y ábrela en Safari.
            </Typography>
            <Button
              variant="contained"
              startIcon={<OpenInBrowserIcon />}
              onClick={() => {
                window.location.href = 'safari-http://' + window.location.host + window.location.pathname;
              }}
              sx={{
                bgcolor: '#CE1126',
                '&:hover': { bgcolor: '#a50e1f' },
                fontWeight: 700,
                borderRadius: 2,
                textTransform: 'none',
              }}
            >
              Abrir en Safari
            </Button>
          </Box>
        )}

        <Typography
          variant="caption"
          sx={{ display: 'block', mt: 2, textAlign: 'center', color: 'text.disabled' }}
        >
          Una vez instalada, la app aparecerá en tu pantalla de inicio y funcionará sin conexión a internet.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'center' }}>
        <Button
          variant="outlined"
          onClick={() => {
            setShowIOSDialog(false);
            handleDismiss();
          }}
          sx={{
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: 2,
            borderColor: '#CE1126',
            color: '#CE1126',
            '&:hover': { borderColor: '#a50e1f', bgcolor: '#FFF5F5' },
          }}
        >
          Entendido, no volver a mostrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}