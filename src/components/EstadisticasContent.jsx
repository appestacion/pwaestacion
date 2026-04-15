import React, { useEffect, useState } from 'react';
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
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line,
  AreaChart, Area,
} from 'recharts';
import SpeedIcon from '@mui/icons-material/Speed';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { useCierreStore } from '../store/useCierreStore.js';
import { useGandolaStore } from '../store/useGandolaStore.js';
import { formatNumber, formatUSD, formatBs } from '../lib/formatters.js';
import { calcTotalLitersSold, calcLitersByIsland, calculateBiblia, calculateBibliaTotals } from '../lib/calculations.js';
import { SHIFT_LABELS, SUPERVISOR_SHIFT_LABELS, ISLAND_LABELS } from '../config/constants.js';

const COLORS_PIE = ['#CE1126', '#003399', '#FFD100', '#00A651', '#FF6600', '#9C27B0'];

export default function EstadisticasContent() {
  const { shiftsHistory, loadShiftsHistory } = useCierreStore();
  const { receptionsHistory, loadReceptionsHistory } = useGandolaStore();
  const [periodo, setPeriodo] = useState('todos');

  useEffect(() => {
    loadShiftsHistory();
    loadReceptionsHistory();
  }, [loadShiftsHistory, loadReceptionsHistory]);

  // Filter shifts by period
  const filteredShifts = (() => {
    const now = new Date();
    if (periodo === 'hoy') {
      return shiftsHistory.filter((s) => s.date === new Date().toLocaleDateString('es-VE'));
    }
    if (periodo === 'semana') {
      const hace7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return shiftsHistory.filter((s) => {
        const d = new Date(s.createdAt);
        return d >= hace7;
      });
    }
    if (periodo === 'mes') {
      const hace30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return shiftsHistory.filter((s) => {
        const d = new Date(s.createdAt);
        return d >= hace30;
      });
    }
    return shiftsHistory;
  })();

  // Calculate summary stats
  const totalTurnos = filteredShifts.length;
  const totalLitros = filteredShifts.reduce((sum, s) => sum + calcTotalLitersSold(s.pumpReadings || []), 0);
  const litrosDiurno = filteredShifts
    .filter((s) => s.operatorShiftType === 'DIURNO')
    .reduce((sum, s) => sum + calcTotalLitersSold(s.pumpReadings || []), 0);
  const litrosNocturno = filteredShifts
    .filter((s) => s.operatorShiftType === 'NOCTURNO')
    .reduce((sum, s) => sum + calcTotalLitersSold(s.pumpReadings || []), 0);

  // Calculate income totals using Biblia
  const totalIngresosUSD = filteredShifts.reduce((sum, s) => {
    if (!s.islands) return sum;
    const biblia = calculateBiblia(s);
    const totals = calculateBibliaTotals(biblia);
    return sum + totals.totalIngresosUSD;
  }, 0);
  const totalPropinaUSD = filteredShifts.reduce((sum, s) => {
    if (!s.islands) return sum;
    const biblia = calculateBiblia(s);
    const totals = calculateBibliaTotals(biblia);
    return sum + totals.totalPropinaUSD;
  }, 0);
  const totalPropinaBs = filteredShifts.reduce((sum, s) => {
    if (!s.islands) return sum;
    const biblia = calculateBiblia(s);
    const totals = calculateBibliaTotals(biblia);
    return sum + totals.totalPropinaBs;
  }, 0);

  // Total gandola receptions
  const totalRecepciones = receptionsHistory.length;
  const totalLitrosGandola = receptionsHistory.reduce((sum, r) => {
    if (!r.tankReadings) return sum;
    return sum + r.tankReadings.reduce((s, t) => s + (t.litersDifference || 0), 0);
  }, 0);

  // Liters by island chart data
  const litrosPorIslaData = [1, 2, 3].map((id) => {
    const liters = filteredShifts.reduce((sum, s) => {
      const readings = s.pumpReadings || [];
      return sum + readings.filter((r) => r.islandId === id).reduce((s2, r) => s2 + r.litersSold, 0);
    }, 0);
    return { name: ISLAND_LABELS[id], litros: Math.round(liters), color: id === 1 ? '#CE1126' : id === 2 ? '#003399' : '#00A651' };
  });

  // Shift type distribution for pie chart
  const distribucionTurnosData = [
    { name: 'Diurno (7AM-7PM)', value: filteredShifts.filter((s) => s.operatorShiftType === 'DIURNO').length },
    { name: 'Nocturno (7PM-7AM)', value: filteredShifts.filter((s) => s.operatorShiftType === 'NOCTURNO').length },
  ].filter((d) => d.value > 0);

  // Liters by day (last 15 shifts sorted by date)
  const tendenciasData = [...filteredShifts]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-15)
    .map((s) => ({
      fecha: s.date ? s.date.substring(0, 5) : '--',
      litros: calcTotalLitersSold(s.pumpReadings || []),
      tipo: s.operatorShiftType === 'DIURNO' ? 'Diurno' : 'Nocturno',
    }));

  // Income by shift (area chart)
  const ingresosData = [...filteredShifts]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-15)
    .map((s) => {
      let ingresosUSD = 0;
      if (s.islands) {
        const biblia = calculateBiblia(s);
        const totals = calculateBibliaTotals(biblia);
        ingresosUSD = totals.totalIngresosUSD;
      }
      return {
        fecha: s.date ? s.date.substring(0, 5) : '--',
        ingresos: Math.round(ingresosUSD * 100) / 100,
      };
    });

  // Summary cards
  const statCards = [
    { label: 'Turnos Cerrados', value: totalTurnos, icon: <CalendarTodayIcon />, color: '#CE1126' },
    { label: 'Litros Totales', value: formatNumber(totalLitros, 0), icon: <LocalGasStationIcon />, color: '#003399' },
    { label: 'Ingresos Totales', value: formatUSD(totalIngresosUSD), icon: <AttachMoneyIcon />, color: '#00A651' },
    { label: 'Propina Total', value: formatUSD(totalPropinaUSD), icon: <TrendingUpIcon />, color: '#FFD100' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Estadisticas</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Resumen y analisis de operaciones de la estacion
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Periodo</InputLabel>
          <Select value={periodo} label="Periodo" onChange={(e) => setPeriodo(e.target.value)}>
            <MenuItem value="todos">Todos</MenuItem>
            <MenuItem value="hoy">Hoy</MenuItem>
            <MenuItem value="semana">Ultima Semana</MenuItem>
            <MenuItem value="mes">Ultimo Mes</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map((stat) => (
          <Grid item xs={6} sm={3} key={stat.label}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '12px', bgcolor: `${stat.color}15`, color: stat.color }}>
                    {stat.icon}
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', lineHeight: 1.2 }}>
                      {stat.label}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2, fontSize: { xs: '1rem', sm: '1.3rem' } }}>
                      {stat.value}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {filteredShifts.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No hay datos de turnos cerrados en el periodo seleccionado. Los estadisticas se generan a partir de los cierres de turno realizados.
        </Alert>
      ) : (
        <>
          {/* Liters by Island + Shift Type Distribution */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={7}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'primary.main' }}>
                    <SpeedIcon sx={{ mr: 1, verticalAlign: 'middle' }} fontSize="small" />
                    Litros Vendidos por Isla
                  </Typography>
                  <Box sx={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer>
                      <BarChart data={litrosPorIslaData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value) => [`${formatNumber(value, 0)} L`, 'Litros']} />
                        <Bar dataKey="litros" radius={[6, 6, 0, 0]}>
                          {litrosPorIslaData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Chip label={`Diurno: ${formatNumber(litrosDiurno, 0)} L`} size="small" sx={{ bgcolor: '#CE112620', color: '#CE1126', fontWeight: 600 }} />
                    <Chip label={`Nocturno: ${formatNumber(litrosNocturno, 0)} L`} size="small" sx={{ bgcolor: '#00339920', color: '#003399', fontWeight: 600 }} />
                    <Chip label={`Total: ${formatNumber(totalLitros, 0)} L`} size="small" variant="outlined" color="primary" sx={{ fontWeight: 600 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={5}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'secondary.main' }}>
                    Distribucion por Turno
                  </Typography>
                  <Box sx={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={distribucionTurnosData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={4}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {distribucionTurnosData.map((_, index) => (
                            <Cell key={index} fill={COLORS_PIE[index % COLORS_PIE.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value} turnos`, 'Cantidad']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                  <Box sx={{ textAlign: 'center', mt: 1 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {totalTurnos} turnos cerrados en total
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Liters Trend */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'warning.main' }}>
                Tendencia de Litros Vendidos
              </Typography>
              <Box sx={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <LineChart data={tendenciasData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === 'litros') return [formatNumber(value, 0) + ' L', 'Litros'];
                        return [value, name];
                      }}
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          return `${payload[0].payload.fecha} - ${payload[0].payload.tipo}`;
                        }
                        return label;
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="litros" name="Litros" stroke="#CE1126" strokeWidth={2} dot={{ r: 4, fill: '#CE1126' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>

          {/* Income Trend */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'success.main' }}>
                Tendencia de Ingresos (USD)
              </Typography>
              <Box sx={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <AreaChart data={ingresosData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => [formatUSD(value), 'Ingresos']} />
                    <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#00A651" fill="#00A65130" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>

          {/* Gandola Summary */}
          {totalRecepciones > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: '#9C27B0' }}>
                  Recepciones de Gandola
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Total Recepciones</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{totalRecepciones}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Litros Recibidos</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#00A651' }}>{formatNumber(totalLitrosGandola, 0)} L</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Propina Summary */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'warning.main' }}>
                Resumen de Propinas
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>Propina Total USD</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>{formatUSD(totalPropinaUSD)}</Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>Propina Total Bs</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>{formatBs(totalPropinaBs)}</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>Promedio por Turno</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {totalTurnos > 0 ? formatUSD(totalPropinaUSD / totalTurnos) : formatUSD(0)}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Recent Shifts Table */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
                Detalle de Turnos Recientes
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Turno Operador</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Turno Supervisor</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Litros</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Tasa 1</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Tasa 2</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="center">Estado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredShifts.slice(0, 20).map((shift) => (
                      <TableRow key={shift.id} hover>
                        <TableCell>{shift.date}</TableCell>
                        <TableCell>
                          <Chip
                            label={shift.operatorShiftType === 'DIURNO' ? 'Diurno' : 'Nocturno'}
                            size="small"
                            color={shift.operatorShiftType === 'DIURNO' ? 'secondary' : 'primary'}
                            variant="outlined"
                            sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                          />
                        </TableCell>
                        <TableCell>
                          {SUPERVISOR_SHIFT_LABELS[shift.supervisorShiftType] || '--'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {formatNumber(calcTotalLitersSold(shift.pumpReadings || []), 0)} L
                        </TableCell>
                        <TableCell align="right">{formatBs(shift.tasa1)}</TableCell>
                        <TableCell align="right">{shift.tasa2 > 0 ? formatBs(shift.tasa2) : '--'}</TableCell>
                        <TableCell align="center">
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
              {filteredShifts.length > 20 && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1, textAlign: 'center' }}>
                  Mostrando los primeros 20 de {filteredShifts.length} turnos
                </Typography>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
