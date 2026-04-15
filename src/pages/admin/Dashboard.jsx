import React, { useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import PeopleIcon from '@mui/icons-material/People';
import CategoryIcon from '@mui/icons-material/Category';
import SettingsIcon from '@mui/icons-material/Settings';
import SpeedIcon from '@mui/icons-material/Speed';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useNavigate } from 'react-router-dom';
import { useCierreStore } from '../../store/useCierreStore.js';
import useStore from '../../store/useStore.js';
import { useProductStore } from '../../store/useProductStore.js';
import { useConfigStore } from '../../store/useConfigStore.js';
import { formatBs } from '../../lib/formatters.js';

export default function DashboardAdmin() {
  const { shiftsHistory, loadShiftsHistory } = useCierreStore();
  const getAllUsers = useStore((state) => state.getAllUsers);
  const { products, loadProducts } = useProductStore();
  const config = useConfigStore((state) => state.config);
  const navigate = useNavigate();
  const [users, setUsers] = React.useState([]);

  useEffect(() => {
    loadShiftsHistory();
    loadProducts();
    getAllUsers().then(setUsers);
  }, [loadShiftsHistory, loadProducts, getAllUsers]);

  const activeProducts = products.filter((p) => p.active);

  const statCards = [
    { label: 'Usuarios', value: users.length || 0, icon: <PeopleIcon />, color: '#CE1126', path: '/admin/usuarios' },
    { label: 'Productos', value: activeProducts.length, icon: <CategoryIcon />, color: '#003399', path: '/admin/productos' },
    { label: 'Tasa BCV', value: formatBs(config.tasa1), icon: <TrendingUpIcon />, color: '#FFD100', path: '/admin/configuracion' },
    { label: 'Turnos Cerrados', value: shiftsHistory.length, icon: <SpeedIcon />, color: '#00A651', path: '/' },
  ];

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Dashboard Administrador</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Gestión general del sistema
        </Typography>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map((stat) => (
          <Grid item xs={6} sm={3} key={stat.label}>
            <Card
              sx={{ cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 } }}
              onClick={() => navigate(stat.path)}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 44,
                      height: 44,
                      borderRadius: '12px',
                      bgcolor: `${stat.color}15`,
                      color: stat.color,
                    }}
                  >
                    {stat.icon}
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      {stat.label}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                      {stat.value}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Recent Shifts */}
      {shiftsHistory.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Turnos Recientes</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Turno</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Tasa</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Estado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shiftsHistory.slice(0, 10).map((shift) => (
                    <TableRow key={shift.id} hover>
                      <TableCell>{shift.date}</TableCell>
                      <TableCell>{shift.operatorShiftType || '--'}</TableCell>
                      <TableCell>{formatBs(shift.tasa1)}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={shift.status === 'cerrado' ? 'Cerrado' : 'En Progreso'}
                          size="small"
                          color={shift.status === 'cerrado' ? 'success' : 'warning'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
