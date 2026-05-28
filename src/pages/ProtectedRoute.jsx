// src/pages/ProtectedRoute.jsx
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import useStore from '../store/useStore.js';

/**
 * ProtectedRoute — Guardia de rutas con verificación de autenticación y rol.
 *
 * Uso:
 *   <Route element={<ProtectedRoute />}>  → solo requiere autenticación
 *   <Route element={<ProtectedRoute roles={['administrador']} />}>  → solo admin
 *   <Route element={<ProtectedRoute roles={['administrador', 'supervisor']} />}>  → admin + supervisor
 */
export default function ProtectedRoute({ roles }) {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const authLoading = useStore((state) => state.authLoading);
  const user = useStore((state) => state.user);
  const location = useLocation();

  // Mientras carga la autenticación, mostrar spinner
  if (authLoading && !isAuthenticated) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Verificando acceso...
        </Typography>
      </Box>
    );
  }

  // No autenticado → redirigir al login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Si se especificaron roles, verificar que el usuario tenga uno permitido
  if (roles && Array.isArray(roles) && roles.length > 0) {
    if (!user?.role || !roles.includes(user.role)) {
      // Redirigir al dashboard del supervisor (o al raíz) si no tiene permiso
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
}