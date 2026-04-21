// src/pages/admin/Configuracion.jsx
import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteIcon from '@mui/icons-material/Delete';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import SyncIcon from '@mui/icons-material/Sync';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import CircularProgress from '@mui/material/CircularProgress';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useConfigStore } from '../../store/useConfigStore.js';
import { uploadImageToImgbb } from '../../lib/imgbbUpload.js';
import { enqueueSnackbar } from 'notistack';

export default function Configuracion() {
  const { config, firestoreActive, loadConfig, updateConfig, resetConfig } = useConfigStore();
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadConfig();
    return () => useConfigStore.getState().cleanup();
  }, [loadConfig]);

  useEffect(() => {
    if (config.stationLogo) {
      setPreview(config.stationLogo);
    }
  }, [config.stationLogo]);

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

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      enqueueSnackbar({ message: 'Solo se permiten archivos de imagen', variant: 'error' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      enqueueSnackbar({ message: 'La imagen no debe superar 5MB', variant: 'error' });
      return;
    }

    setUploading(true);
    try {
      const localPreview = URL.createObjectURL(file);
      setPreview(localPreview);

      const result = await uploadImageToImgbb(file);

      updateConfig({ stationLogo: result.url });

      enqueueSnackbar({
        message: 'Logo subido a imgbb correctamente',
        variant: 'success',
      });
    } catch (error) {
      console.error('Error subiendo logo:', error);
      setPreview(config.stationLogo || '');
      enqueueSnackbar({
        message: `Error al subir imagen: ${error.message}`,
        variant: 'error',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = () => {
    setPreview('');
    updateConfig({ stationLogo: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
    enqueueSnackbar({ message: 'Logo eliminado', variant: 'info' });
  };

  const handleReset = () => {
    if (window.confirm('¿Estás seguro de restaurar la configuración por defecto? Se perderán todos los cambios.')) {
      resetConfig();
      setPreview('');
      enqueueSnackbar({ message: 'Configuración restaurada por defecto', variant: 'info' });
    }
  };

  // Formatear a 2 decimales para mostrar en los campos de tasa
  const tasa1Display = config.tasa1 != null ? parseFloat(config.tasa1).toFixed(2) : '';
  const tasa2Display = config.tasa2 != null ? parseFloat(config.tasa2).toFixed(2) : '';

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Configuración</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Personaliza el sistema con los datos de tu estación de servicio
        </Typography>
      </Box>

      {/* Station Identity */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'primary.main' }}>
            Identidad de la Estación
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nombre de la Estación"
                value={config.stationName}
                onChange={(e) => updateConfig({ stationName: e.target.value })}
                placeholder="Ej: Estación de Servicio Los Andes"
                helperText="Este nombre aparecerá en toda la aplicación y en los PDFs generados"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="RIF"
                value={config.stationRif}
                onChange={(e) => updateConfig({ stationRif: e.target.value })}
                placeholder="Ej: J-12345678-9"
                helperText="Registro de Información Fiscal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Dirección"
                value={config.stationAddress}
                onChange={(e) => updateConfig({ stationAddress: e.target.value })}
                placeholder="Ej: Av. Principal, Caracas, Venezuela"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Teléfono"
                value={config.stationPhone}
                onChange={(e) => updateConfig({ stationPhone: e.target.value })}
                placeholder="Ej: +58 212-1234567"
              />
            </Grid>
          </Grid>

          {/* Logo */}
          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700 }}>
            Logo de la Estación
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ position: 'relative' }}>
              {preview ? (
                <Avatar
                  src={preview}
                  alt={config.stationName}
                  sx={{ width: 80, height: 80, borderRadius: 2, bgcolor: 'grey.100' }}
                  variant="rounded"
                />
              ) : (
                <Box
                  sx={{
                    width: 80, height: 80, borderRadius: 2, bgcolor: 'grey.100',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <LocalGasStationIcon sx={{ fontSize: 40, color: 'grey.400' }} />
                </Box>
              )}
              {uploading && (
                <Box
                  sx={{
                    position: 'absolute', inset: 0, borderRadius: 2,
                    bgcolor: 'rgba(0,0,0,0.4)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <CircularProgress size={28} sx={{ color: 'white' }} />
                </Box>
              )}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleLogoUpload}
                disabled={uploading}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={uploading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Subiendo a imgbb...' : 'Subir Logo'}
              </Button>
              {preview && !uploading && (
                <Button
                  variant="text"
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleRemoveLogo}
                >
                  Eliminar Logo
                </Button>
              )}
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Imagen PNG o JPG, máximo 5MB. Se guarda en imgbb (nube).
              </Typography>
              {preview && !preview.startsWith('blob:') && (
                <Typography variant="caption" sx={{ color: 'success.main' }}>
                  Imagen hospedada en imgbb
                </Typography>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Exchange Rate */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'secondary.main' }}>
              Tasa de Cambio BCV
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
            <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Rotación automática de tasas
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                Cada vez que la API actualiza: tasa2 actual pasa a tasa1, y la nueva tasa se guarda como tasa2.
                Horario: Lun-Vie, 3:00 PM - 10:00 PM, cada 3 minutos.
              </Typography>
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Tasa 1 (Bs. por $)"
                type="number"
                value={tasa1Display}
                onChange={(e) => updateConfig({ tasa1: parseFloat(e.target.value) || 0 })}
                InputProps={{ startAdornment: <span style={{ marginRight: 4 }}>Bs.</span> }}
                helperText="Tasa principal"
                InputLabelProps={{ shrink: true }}
                inputProps={{ step: '0.01', min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Tasa 2 (Bs. por $)"
                type="number"
                value={tasa2Display}
                onChange={(e) => updateConfig({ tasa2: parseFloat(e.target.value) || 0 })}
                InputProps={{ startAdornment: <span style={{ marginRight: 4 }}>Bs.</span> }}
                helperText="Segunda tasa"
                InputLabelProps={{ shrink: true }}
                inputProps={{ step: '0.01', min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
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
          </Grid>
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
                <strong>Sistema de Cierre de Estación de Servicio</strong> v1.0.0
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Aplicación PWA para gestión de cierres de turno, lecturas de surtidores y tanques, control financiero (Biblia, Cuadre PV), inventario de productos, recepción de gandolas y generación de reportes en PDF.
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
        <Button
          variant="outlined"
          color="warning"
          startIcon={<RestartAltIcon />}
          onClick={handleReset}
        >
          Restaurar Valores por Defecto
        </Button>
      </Box>
    </Box>
  );
}