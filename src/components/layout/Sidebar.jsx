import React from 'react';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import Avatar from '@mui/material/Avatar';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SpeedIcon from '@mui/icons-material/Speed';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import BookIcon from '@mui/icons-material/Book';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import InventoryIcon from '@mui/icons-material/Inventory';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PeopleIcon from '@mui/icons-material/People';
import CategoryIcon from '@mui/icons-material/Category';
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import CloseIcon from '@mui/icons-material/Close';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import BarChartIcon from '@mui/icons-material/BarChart';
import { useLocation, useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore.js';
import { useConfigStore } from '../../store/useConfigStore.js';

const DRAWER_WIDTH = 260;

const supervisorMenuItems = [
  { path: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { path: '/lecturas', label: 'Lecturas', icon: <SpeedIcon /> },
  { path: '/cierre', label: 'Cierre de Turno', icon: <ReceiptLongIcon /> },
  { path: '/biblia', label: 'Biblia', icon: <BookIcon /> },
  { path: '/cuadre-pv', label: 'Cuadre PV', icon: <PointOfSaleIcon /> },
  { path: '/inventario', label: 'Inventario', icon: <InventoryIcon /> },
  { path: '/recepcion-gandola', label: 'Recepcion Gandola', icon: <LocalShippingIcon /> },
  { path: '/generar-pdf', label: 'Generar PDF', icon: <PictureAsPdfIcon /> },
  { path: '/estadisticas', label: 'Estadisticas', icon: <BarChartIcon /> },
];

const adminMenuItems = [
  { path: '/admin', label: 'Admin Dashboard', icon: <DashboardIcon /> },
  { path: '/admin/usuarios', label: 'Gestion Usuarios', icon: <PeopleIcon /> },
  { path: '/admin/productos', label: 'Gestion Productos', icon: <CategoryIcon /> },
  { path: '/admin/configuracion', label: 'Configuracion', icon: <SettingsIcon /> },
  { path: '/admin/estadisticas', label: 'Estadisticas', icon: <BarChartIcon /> },
];

export default function Sidebar() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();
  const navigate = useNavigate();
  const sidebarOpen = useStore((state) => state.sidebarOpen);
  const setSidebarOpen = useStore((state) => state.setSidebarOpen);
  const user = useStore((state) => state.user);
  const config = useConfigStore((state) => state.config);

  const handleNavigate = (path) => {
    navigate(path);
    if (isMobile) setSidebarOpen(false);
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo / Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-end', px: 2, py: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {config.stationLogo ? (
            <Avatar src={config.stationLogo} alt={config.stationName} sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: 'grey.100' }} variant="rounded" />
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '10px', bgcolor: 'primary.main' }}>
              <LocalGasStationIcon sx={{ color: 'white', fontSize: 24 }} />
            </Box>
          )}
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'primary.main', lineHeight: 1.2, fontSize: '0.85rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {config.stationName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>Sistema de Cierre</Typography>
          </Box>
        </Box>
        {isMobile ? (
          <IconButton onClick={() => setSidebarOpen(false)} size="small"><CloseIcon /></IconButton>
        ) : (
          <IconButton onClick={() => setSidebarOpen(false)} size="small"><ChevronLeftIcon /></IconButton>
        )}
      </Box>
      <Divider />
      {/* Menu based on role */}
      <List sx={{ flex: 1, py: 1 }}>
        {user?.role === 'administrador' && (
          <>
            <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary', fontWeight: 600 }}>ADMINISTRACION</Typography>
            {adminMenuItems.map((item) => (
              <ListItem key={item.path} disablePadding sx={{ px: 1 }}>
                <ListItemButton selected={location.pathname === item.path} onClick={() => handleNavigate(item.path)} sx={{ borderRadius: 2, mb: 0.5, '&.Mui-selected': { backgroundColor: 'primary.main', color: 'white', '& .MuiListItemIcon-root': { color: 'white' }, '&:hover': { backgroundColor: 'primary.dark' } } }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.875rem' }} />
                </ListItemButton>
              </ListItem>
            ))}
          </>
        )}
        {user?.role === 'supervisor' && (
          <>
            <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary', fontWeight: 600 }}>OPERACIONES</Typography>
            {supervisorMenuItems.map((item) => (
              <ListItem key={item.path} disablePadding sx={{ px: 1 }}>
                <ListItemButton selected={location.pathname === item.path} onClick={() => handleNavigate(item.path)} sx={{ borderRadius: 2, mb: 0.5, '&.Mui-selected': { backgroundColor: 'primary.main', color: 'white', '& .MuiListItemIcon-root': { color: 'white' }, '&:hover': { backgroundColor: 'primary.dark' } } }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.875rem' }} />
                </ListItemButton>
              </ListItem>
            ))}
          </>
        )}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        {config.stationRif && config.stationRif !== 'J-00000000-0' && (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>{config.stationRif}</Typography>
        )}
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{config.stationAddress}</Typography>
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer variant="temporary" open={sidebarOpen} onClose={() => setSidebarOpen(false)} ModalProps={{ keepMounted: true }} sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, borderRight: 'none' } }}>
        {drawerContent}
      </Drawer>
    );
  }

  return (
    <Drawer variant="persistent" open={sidebarOpen} sx={{ width: sidebarOpen ? DRAWER_WIDTH : 0, flexShrink: 0, transition: 'width 0.2s', '& .MuiDrawer-paper': { width: DRAWER_WIDTH, borderRight: '1px solid', borderColor: 'divider' } }}>
      {drawerContent}
    </Drawer>
  );
}
