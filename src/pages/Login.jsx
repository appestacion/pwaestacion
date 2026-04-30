import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import Avatar from '@mui/material/Avatar';
import CircularProgress from '@mui/material/CircularProgress';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore.js';
import { useConfigStore } from '../store/useConfigStore.js';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  const login = useStore((state) => state.login);
  const sendPasswordReset = useStore((state) => state.sendPasswordReset);
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const user = useStore((state) => state.user);
  const navigate = useNavigate();
  const config = useConfigStore((state) => state.config);

  const primaryColor = config.stationColorPrimary || '#CE1126';
  const primaryDark = config.stationColorPrimary
    ? darkenColor(config.stationColorPrimary, 25)
    : '#8B0000';

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(user.role === 'administrador' ? '/admin' : '/', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const success = await login(email, password);
      if (success) {
        await new Promise((r) => setTimeout(r, 300));
        const currentUser = useStore.getState().user;
        if (currentUser) {
          navigate(currentUser.role === 'administrador' ? '/admin' : '/', { replace: true });
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess(false);
    if (!resetEmail.trim()) {
      setResetError('Ingresa tu correo electrónico');
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordReset(resetEmail.trim());
      setResetSuccess(true);
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setMode('login');
    setResetEmail('');
    setResetError('');
    setResetSuccess(false);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: '#F5F5F5',
      }}
    >
      {/* Banner curvado superior - 30% alto */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '30%',
          background: `linear-gradient(160deg, ${primaryColor} 0%, ${primaryDark} 100%)`,
          borderRadius: '0 0 50% 50%',
          zIndex: 0,
        }}
      />

      <Card
        sx={{
          maxWidth: 420,
          width: '92%',
          borderRadius: 4,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          position: 'relative',
          zIndex: 1,
          overflow: 'visible',
        }}
      >
        <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

          {/* Logo DENTRO de la tarjeta - grande */}
          <Box
            sx={{
              width: 96,
              height: 96,
              borderRadius: '16px',
              bgcolor: `${primaryColor}10`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
              border: '3px solid #fff',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              overflow: 'hidden',
            }}
          >
            {config.stationLogo ? (
              <Avatar
                src={config.stationLogo}
                alt={config.stationName}
                sx={{ width: 76, height: 76, borderRadius: 3 }}
                variant="rounded"
              />
            ) : (
              <LocalGasStationIcon sx={{ fontSize: 52, color: primaryColor }} />
            )}
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 800, color: primaryColor, textAlign: 'center', mb: 0.5 }}>
            {config.stationName}
          </Typography>

          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', mb: 3, fontSize: '0.8rem' }}>
            Sistema de Cierre de Estación de Servicio
          </Typography>

          {/* ========== MODO LOGIN ========== */}
          {mode === 'login' && (
            <>
              {error && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2, width: '100%' }}>{error}</Alert>
              )}

              <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                <TextField
                  fullWidth
                  label="Correo Electrónico"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      bgcolor: '#FAFAFA',
                      '&.Mui-focused': { bgcolor: '#fff' },
                    },
                  }}
                  autoFocus
                />

                <TextField
                  fullWidth
                  label="Contraseña"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small" sx={{ color: 'text.secondary' }}>
                          {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    mb: 1,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      bgcolor: '#FAFAFA',
                      '&.Mui-focused': { bgcolor: '#fff' },
                    },
                  }}
                />

                <Box sx={{ textAlign: 'right', mb: 3 }}>
                  <Button
                    type="button"
                    size="small"
                    onClick={() => { setMode('reset'); setResetEmail(email); setError(''); }}
                    sx={{
                      color: primaryColor,
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      textTransform: 'none',
                      p: 0,
                      '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                    }}
                  >
                    ¿Olvidaste tu contraseña?
                  </Button>
                </Box>

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading || !email || !password}
                  sx={{
                    py: 1.5,
                    fontSize: '1rem',
                    fontWeight: 700,
                    borderRadius: 2,
                    bgcolor: primaryColor,
                    boxShadow: `0 4px 16px ${primaryColor}55`,
                    '&:hover': { bgcolor: primaryDark, boxShadow: `0 6px 20px ${primaryColor}70` },
                    '&.Mui-disabled': { background: '#E0E0E0', color: '#9E9E9E', boxShadow: 'none' },
                  }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Iniciar Sesión'}
                </Button>
              </form>
            </>
          )}

          {/* ========== MODO RECUPERAR CONTRASEÑA ========== */}
          {mode === 'reset' && (
            <>
              <Box sx={{ alignSelf: 'flex-start', mb: 1 }}>
                <Button
                  onClick={handleBackToLogin}
                  startIcon={<ArrowBackIcon />}
                  size="small"
                  sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: 'transparent' } }}
                >
                  Volver al login
                </Button>
              </Box>

              <Typography variant="body1" sx={{ fontWeight: 600, textAlign: 'center', mb: 0.5, color: 'text.primary' }}>
                Recuperar Contraseña
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', mb: 3, fontSize: '0.82rem', lineHeight: 1.5 }}>
                Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
              </Typography>

              {resetError && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2, width: '100%' }}>{resetError}</Alert>
              )}

              {resetSuccess && (
                <Alert severity="success" sx={{ mb: 2, borderRadius: 2, width: '100%' }}>
                  Se envió un correo de recuperación a <strong>{resetEmail}</strong>. Revisa tu bandeja de entrada y sigue las instrucciones.
                </Alert>
              )}

              <form onSubmit={handleResetSubmit} style={{ width: '100%' }}>
                <TextField
                  fullWidth
                  label="Correo Electrónico"
                  type="email"
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    mb: 3,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      bgcolor: '#FAFAFA',
                      '&.Mui-focused': { bgcolor: '#fff' },
                    },
                  }}
                  autoFocus
                  disabled={resetSuccess}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={resetLoading || !resetEmail.trim() || resetSuccess}
                  sx={{
                    py: 1.5,
                    fontSize: '1rem',
                    fontWeight: 700,
                    borderRadius: 2,
                    bgcolor: primaryColor,
                    boxShadow: `0 4px 16px ${primaryColor}55`,
                    '&:hover': { bgcolor: primaryDark, boxShadow: `0 6px 20px ${primaryColor}70` },
                    '&.Mui-disabled': { background: '#E0E0E0', color: '#9E9E9E', boxShadow: 'none' },
                  }}
                >
                  {resetLoading ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : resetSuccess ? (
                    'Correo Enviado'
                  ) : (
                    'Enviar Enlace de Recuperación'
                  )}
                </Button>
              </form>

              {resetSuccess && (
                <Button
                  onClick={handleBackToLogin}
                  fullWidth
                  variant="outlined"
                  size="large"
                  sx={{
                    mt: 2,
                    py: 1.5,
                    fontSize: '1rem',
                    fontWeight: 700,
                    borderRadius: 2,
                    borderColor: primaryColor,
                    color: primaryColor,
                    textTransform: 'none',
                    '&:hover': { borderColor: primaryDark, bgcolor: `${primaryColor}08` },
                  }}
                >
                  Volver al Login
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

function darkenColor(hex, percent) {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  const num = parseInt(hex, 16);
  const r = Math.max(0, (num >> 16) - Math.round(255 * (percent / 100)));
  const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(255 * (percent / 100)));
  const b = Math.max(0, (num & 0x0000FF) - Math.round(255 * (percent / 100)));
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}