import React, { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore.js';
import { useCierreStore } from '../../store/useCierreStore.js';
import { useNetworkStore } from '../../store/useNetworkStore.js';
import { formatDate, getVenezuelaDate } from '../../lib/formatters.js';
import { SUPERVISOR_SHIFT_LABELS } from '../../config/constants.js';

export default function Topbar() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const toggleSidebar = useStore((state) => state.toggleSidebar);
  const user = useStore((state) => state.user);
  const logout = useStore((state) => state.logout);
  const currentShift = useCierreStore((state) => state.currentShift);
  const isOnline = useNetworkStore((state) => state.isOnline);
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleLogout = async () => {
    setAnchorEl(null);
    await logout();
    navigate('/login', { replace: true });
  };

  const now = getVenezuelaDate();

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        color: 'text.primary',
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        <IconButton
          edge="start"
          onClick={toggleSidebar}
          sx={{ color: 'text.primary', mr: 1 }}
        >
          <MenuIcon />
        </IconButton>

        <Typography
          variant="subtitle2"
          sx={{
            display: { xs: 'none', sm: 'block' },
            color: 'text.secondary',
            fontWeight: 500,
          }}
        >
          {formatDate(now)}
        </Typography>

        <Box sx={{ flex: 1 }} />

        {/* Indicador de conexion */}
        {isOnline ? (
          <Tooltip title="Conectado - Sincronizando con Firebase">
            <CloudSyncIcon sx={{ color: '#4CAF50', fontSize: 20 }} />
          </Tooltip>
        ) : (
          <Tooltip title="Sin conexion - Modo offline (datos locales)">
            <Chip
              icon={<WifiOffIcon sx={{ fontSize: '16px !important' }} />}
              label="Offline"
              size="small"
              color="warning"
              variant="outlined"
              sx={{ height: 28, fontSize: '0.7rem', fontWeight: 600 }}
            />
          </Tooltip>
        )}

        {currentShift && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={SUPERVISOR_SHIFT_LABELS[currentShift.supervisorShiftType] || ''}
              size="small"
              color="info"
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: '0.7rem' }}
            />
            <Chip
              label={currentShift.status === 'en_progreso' ? 'Turno Activo' : 'Turno Cerrado'}
              size="small"
              color={currentShift.status === 'en_progreso' ? 'success' : 'default'}
              sx={{ fontWeight: 600, fontSize: '0.7rem' }}
            />
          </Box>
        )}

        <Tooltip title="Mi Cuenta">
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
            <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: '0.85rem' }}>
              {user?.name?.charAt(0) || 'U'}
            </Avatar>
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          slotProps={{ paper: { sx: { mt: 1, minWidth: 200 } } }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="subtitle2">{user?.name}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {user?.email}
            </Typography>
            <br />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {user?.role === 'administrador' ? 'Administrador' : 'Supervisor'}
            </Typography>
          </Box>
          <Divider />
          <MenuItem onClick={handleLogout}>
            <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
            Cerrar Sesion
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}