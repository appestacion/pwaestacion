// src/pages/admin/Configuracion.jsx
// Panel de configuración exclusivo para E/S Montaña Fresca.
// Solo campos operativos: tasas, dimensiones de estación.
// La identidad está hardcodeada y no se muestra como configurable.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SyncIcon from '@mui/icons-material/Sync';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { useConfigStore } from '../../store/useConfigStore.js';
import { enqueueSnackbar } from 'notistack';

export default function Configuracion() {
  const { config, firestoreActive, loadConfig, updateConfig, resetConfig } = useConfigStore();
  const [showResetButton, setShowResetButton] = useState(false);

  // FIX M7: Debounce para evitar escribir en Firestore en cada tecla
  const debounceRef = useRef(null);
  const debouncedUpdateConfig = useCallback((updates) => {
    updateConfig(updates); // Actualizar estado local inmediatamente (UI reactiva)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateConfig(updates); // Escribir a Firestore después de 1 segundo sin cambios
    }, 1000);
  }, [updateConfig]);

  // Limpiar debounce al desmontar
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const formatLastUpdate = () => {
    if (!config.lastRateUpdate) return null;
    try {
      const date = config.lastRateUpdate.toDate
        ? config.lastRateUpdate.toDate()
        : new Date(config.lastRateUpdate);
      return date.toLocaleString('es-VE', { timeZone: 'America/Caracas' });
    } catch {
      return null;
    }
  };

  const lastUpdateStr = formatLastUpdate();

  const handleReset = () => {
    if (window.confirm('¿Estás seguro de restaurar la configuración por defecto? Se perderán todos los cambios.')) {
      resetConfig();
      enqueueSnackbar({ message: 'Configuración restaurada por defecto', variant: 'info' });
    }
  };

  const handleToggleResetButton = (event) => {
    setShowResetButton(event.target.checked);
  };

  // Formatear a 2 decimales para mostrar en los campos de tasa
  const tasa1Display = config.tasa1 != null ? parseFloat(config.tasa1).toFixed(2) : '';
  const tasa2Display = config.tasa2 != null ? parseFloat(config.tasa2).toFixed(2) : '';

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Configuración</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Parámetros operativos de E/S Montaña Fresca
        </Typography>
      </Box>

      {/* Exchange Rate */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'secondary.main' }}>
              Tasa de Cambio BCV y Precio de Combustible
            </Typography>
            {firestoreActive ? (
              <Chip
                icon={<SyncIcon />}
                label="Auto-actualización activa"
                color="success"
                size="small"
                variant="outlined"
              />
            ) : (
              <Chip
                icon={<WifiOffIcon />}
                label="Modo local (sin Firebase)"
                color="default"
                size="small"
                variant="outlined"
              />
            )}
          </Box>

          {firestoreActive && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              Rotación automática de tasas: cada vez que la API actualiza, tasa2 actual pasa a tasa1 y la nueva tasa se guarda como tasa2. Horario: Todos los días a las 11:45 PM.
            </Typography>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Tasa 1 (Bs. por $)"
                type="number"
                value={tasa1Display}
                onChange={(e) => debouncedUpdateConfig({ tasa1: parseFloat(e.target.value) || 0 })}
                InputProps={{ startAdornment: <span style={{ marginRight: 4 }}>Bs.</span> }}
                helperText="Tasa principal"
                InputLabelProps={{ shrink: true }}
                inputProps={{ step: '0.01', min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Tasa 2 (Bs. por $)"
                type="number"
                value={tasa2Display}
                onChange={(e) => debouncedUpdateConfig({ tasa2: parseFloat(e.target.value) || 0 })}
                InputProps={{ startAdornment: <span style={{ marginRight: 4 }}>Bs.</span> }}
                helperText="Segunda tasa"
                InputLabelProps={{ shrink: true }}
                inputProps={{ step: '0.01', min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Precio Litro (USD)"
                type="number"
                value={config.precioLitroUSD != null ? parseFloat(config.precioLitroUSD).toFixed(2) : '0.50'}
                onChange={(e) => debouncedUpdateConfig({ precioLitroUSD: parseFloat(e.target.value) || 0.50 })}
                InputProps={{ startAdornment: <span style={{ marginRight: 4 }}>$</span> }}
                helperText="Precio por litro en USD"
                InputLabelProps={{ shrink: true }}
                inputProps={{ step: '0.01', min: 0.01 }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              {firestoreActive && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Fecha valor: {config.fechaValor || 'N/A'}
                  </Typography>
                  {lastUpdateStr && (
                    <Typography variant="caption" sx={{ color: 'success.main', display: 'block' }}>
                      Última actualización: {lastUpdateStr}
                    </Typography>
                  )}
                </Box>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Station Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'warning.main' }}>
            Configuración de la Estación
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Define la cantidad de islas, surtidores por isla y tanques. Los cambios se reflejarán en los formularios de lecturas y cierre.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Islas"
                type="number"
                value={config.islandsCount || 3}
                onChange={(e) => updateConfig({ islandsCount: parseInt(e.target.value) || 3 })}
                inputProps={{ min: 1, max: 10 }}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Surtidores por Isla"
                type="number"
                value={config.pumpsPerIsland || 2}
                onChange={(e) => updateConfig({ pumpsPerIsland: parseInt(e.target.value) || 2 })}
                inputProps={{ min: 1, max: 6 }}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Tanques"
                type="number"
                value={config.tanksCount || 3}
                onChange={(e) => updateConfig({ tanksCount: parseInt(e.target.value) || 3 })}
                inputProps={{ min: 1, max: 10 }}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Máx. Cortes"
                type="number"
                value={config.maxCortes || 12}
                onChange={(e) => updateConfig({ maxCortes: parseInt(e.target.value) || 12 })}
                inputProps={{ min: 1, max: 20 }}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Recaudación (%)"
                type="number"
                value={config.porcentajeRecaudacion != null ? parseFloat(config.porcentajeRecaudacion).toFixed(1) : '10'}
                onChange={(e) => updateConfig({ porcentajeRecaudacion: parseFloat(e.target.value) || 10 })}
                InputProps={{ startAdornment: <span style={{ marginRight: 4 }}>%</span> }}
                helperText="Porcentaje sobre propina Bs"
                InputLabelProps={{ shrink: true }}
                inputProps={{ step: '0.1', min: 0, max: 100 }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Advanced Options */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
            Opciones Avanzadas
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Mostrar botón de restaurar configuración
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Activa esta opción para mostrar el botón "Restaurar Valores por Defecto" al final de la página.
              </Typography>
            </Box>
            <Switch
              checked={showResetButton}
              onChange={handleToggleResetButton}
              color="warning"
            />
          </Box>
        </CardContent>
      </Card>

      {/* About */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
            Acerca del Sistema
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                <strong>E/S Montaña Fresca</strong> — Sistema de Gestión v1.0.0
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Aplicación PWA exclusiva para E/S Montaña Fresca (RIF: J-30894985-2). Gestión de cierres de turno, lecturas de surtidores y tanques, control financiero (Biblia, Cuadre PV), inventario de productos, recepción de gandolas y generación de reportes en PDF.
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Ubicación: AV. CASANOVA GODOY ZONA INDUSTRIAL, Aragua - Venezuela
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Configuración de turnos: Supervisor (6:00 AM - 2:00 PM / 2:00 PM - 10:00 PM), Operadores (7:00 AM - 7:00 PM / 7:00 PM - 7:00 AM).
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Zona horaria: America/Caracas (UTC-4) | Moneda: Bolívares (Bs.) / Dólares ($)
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Actions */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        {showResetButton && (
          <Button
            variant="outlined"
            color="warning"
            startIcon={<RestartAltIcon />}
            onClick={handleReset}
          >
            Restaurar Valores por Defecto
          </Button>
        )}
      </Box>
    </Box>
  );
}