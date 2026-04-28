// src/pages/admin/Dashboard.jsx
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import PeopleIcon from '@mui/icons-material/People';
import CategoryIcon from '@mui/icons-material/Category';
import SpeedIcon from '@mui/icons-material/Speed';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area,
  LineChart, Line,
} from 'recharts';
import { useCierreStore } from '../../store/useCierreStore.js';
import useStore from '../../store/useStore.js';
import { useProductStore } from '../../store/useProductStore.js';
import { useConfigStore } from '../../store/useConfigStore.js';
import { formatBs, formatUSD, formatNumber, getVenezuelaDateString } from '../../lib/formatters.js';
import { enqueueSnackbar } from 'notistack';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const COLORS = {
  primary: '#CE1126',
  secondary: '#003399',
  accent: '#FFD100',
  success: '#00A651',
  purple: '#7B1FA2',
  orange: '#FF6600',
  grey: '#9E9E9E',
};

const PIE_COLORS = [COLORS.primary, COLORS.secondary, COLORS.success, COLORS.accent, COLORS.purple, COLORS.orange];
const CHART_GRID = '#EEEEEE';
const CHART_TEXT = '#616161';

function ChartTooltipContent({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <Paper sx={{ p: 1.5, borderRadius: 2, boxShadow: 3 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      {payload.map((entry, i) => (
        <Typography key={i} variant="body2" sx={{ display: 'block', lineHeight: 1.6 }}>
          <span style={{ color: entry.color, fontWeight: 600 }}>{entry.name}:</span>{' '}
          <strong>{typeof entry.value === 'number' ? entry.value.toLocaleString('es-VE', { minimumFractionDigits: 2 }) : entry.value}</strong>
        </Typography>
      ))}
    </Paper>
  );
}

function StatCard({ label, value, icon, color, subtitle, onClick, isMobile, isXs }) {
  return (
    <Card
      onClick={onClick}
      sx={{
        height: '100%',
        transition: 'transform 0.2s, box-shadow 0.2s',
        borderRadius: 3,
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' },
      }}
    >
      <CardContent sx={{ p: isMobile ? 1.5 : 2.5, '&:last-child': { pb: isMobile ? 1.5 : 2.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: isXs ? '0.7rem' : undefined }}>
              {label}
            </Typography>
            <Typography
              variant={isMobile ? 'h6' : 'h4'}
              fontWeight={700}
              color={color}
              sx={{ fontSize: isXs && typeof value === 'string' && value.length > 12 ? '0.9rem' : undefined }}
            >
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: isXs ? '0.6rem' : undefined }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: isMobile ? 38 : 48,
              height: isMobile ? 38 : 48,
              borderRadius: 2,
              bgcolor: `${color}15`,
              color: color,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function ChartCard({ children, title, action, isMobile }) {
  return (
    <Card sx={{ borderRadius: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      {title && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: isMobile ? 1.5 : 2.5, pt: isMobile ? 1.5 : 2, pb: 0 }}>
          <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight={600}>{title}</Typography>
          {action}
        </Box>
      )}
      <CardContent sx={{ p: isMobile ? 1 : 2, '&:last-child': { pb: isMobile ? 1 : 2 } }}>{children}</CardContent>
    </Card>
  );
}

export default function DashboardAdmin() {
  const { shiftsHistory, loadShiftsHistory } = useCierreStore();
  const getAllUsers = useStore((state) => state.getAllUsers);
  const { products, loadProducts } = useProductStore();
  const config = useConfigStore((state) => state.config);
  const chartsRef = useRef(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isXs = useMediaQuery(theme.breakpoints.down('xs'));

  const [tabValue, setTabValue] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [users, setUsers] = useState([]);

  const loadUsers = useCallback(async () => {
    try {
      const data = await getAllUsers();
      const arr = Array.isArray(data) ? data : [];
      setUsers(arr);
    } catch (err) {
      console.error('Error loading users:', err);
      setUsers([]);
    }
  }, [getAllUsers]);

  useEffect(() => {
    loadShiftsHistory();
    loadProducts();
    loadUsers();
  }, [loadShiftsHistory, loadProducts, loadUsers]);

  const activeProducts = products.filter((p) => p.active);
  const closedShifts = shiftsHistory.filter((s) => s.status === 'cerrado');

  const filteredShifts = useMemo(() => {
    let shifts = closedShifts;
    if (dateFrom) shifts = shifts.filter((s) => s.date >= dateFrom);
    if (dateTo) shifts = shifts.filter((s) => s.date <= dateTo);
    return shifts;
  }, [closedShifts, dateFrom, dateTo]);

  const stats = useMemo(() => {
    let totalLiters = 0, totalUSD = 0, totalBs = 0, totalProductsUSD = 0;
    const islandLiters = { 1: 0, 2: 0, 3: 0 };
    const productCount = {};
    const dailyLiters = {};

    filteredShifts.forEach((shift) => {
      (shift.pumpReadings || []).forEach((r) => {
        totalLiters += r.litersSold || 0;
        islandLiters[r.islandId] = (islandLiters[r.islandId] || 0) + (r.litersSold || 0);
      });
      (shift.islands || []).forEach((isl) => {
        totalUSD += isl.pvTotalUSD || 0;
        totalBs += isl.pvTotalBs || 0;
        (isl.productsSold || []).forEach((p) => {
          const qty = p.quantity || 1;
          totalProductsUSD += qty * (p.priceUSD || 0);
          productCount[p.name] = (productCount[p.name] || 0) + qty;
        });
      });
      const d = shift.date || 'Sin fecha';
      dailyLiters[d] = (dailyLiters[d] || 0) + (shift.pumpReadings || []).reduce((sum, r) => sum + (r.litersSold || 0), 0);
    });

    return { totalLiters, totalUSD, totalBs, totalProductsUSD, islandLiters, productCount, dailyLiters };
  }, [filteredShifts]);

  const islandBarData = useMemo(() =>
    Object.entries(stats.islandLiters).map(([id, liters]) => ({
      name: `Isla ${id}`, Litros: Math.round(liters),
      'USD ($)': Math.round((stats.totalUSD / Math.max(stats.totalLiters, 1)) * liters * 100) / 100,
    })), [stats]);

  const dailyAreaData = useMemo(() =>
    Object.entries(stats.dailyLiters).sort(([a], [b]) => a.localeCompare(b)).slice(-14)
      .map(([date, liters]) => ({ date, Litros: Math.round(liters) })), [stats]);

  const productPieData = useMemo(() =>
    Object.entries(stats.productCount)
      .map(([name, count]) => ({ name: name.length > 25 ? name.substring(0, 22) + '...' : name, value: count, fullName: name }))
      .sort((a, b) => b.value - a.value).slice(0, 6), [stats]);

  const revenueLineData = useMemo(() =>
    Object.entries(stats.dailyLiters).sort(([a], [b]) => a.localeCompare(b)).slice(-14)
      .map(([date, liters]) => ({ date, 'Ingresos (Bs)': Math.round(liters * (config.tasa1 || 50)) })), [stats, config.tasa1]);

  const shiftTypePieData = useMemo(() => {
    const counts = { DIURNO: 0, NOCTURNO: 0 };
    filteredShifts.forEach((s) => { if (s.operatorShiftType === 'DIURNO') counts.DIURNO++; else counts.NOCTURNO++; });
    return [{ name: 'Diurno', value: counts.DIURNO }, { name: 'Nocturno', value: counts.NOCTURNO }];
  }, [filteredShifts]);

  const generatePDF = useCallback(() => {
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');
      const fecha = getVenezuelaDateString();

      doc.setFillColor(206, 17, 38);
      doc.rect(0, 0, 297, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text('REPORTE DE ESTACION - DASHBOARD ADMINISTRATIVO', 148.5, 10, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`Generado: ${fecha}  |  Tasa BCV: ${config.tasa1 || 0} Bs/$`, 148.5, 17, { align: 'center' });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text('RESUMEN GENERAL', 14, 32);

      doc.autoTable({
        startY: 35,
        head: [['Metrica', 'Valor', 'Metrica', 'Valor']],
        body: [
          ['Total Usuarios', users.length.toString(), 'Productos Activos', activeProducts.length.toString()],
          ['Turnos Cerrados (periodo)', filteredShifts.length.toString(), 'Litros Totales', formatNumber(stats.totalLiters, 0)],
          ['Ingresos Totales USD', formatUSD(stats.totalUSD), 'Ingresos Totales Bs', formatBs(stats.totalBs)],
          ['Ventas Productos USD', formatUSD(stats.totalProductsUSD), '', ''],
        ],
        theme: 'grid', headStyles: { fillColor: [206, 17, 38], textColor: 255, fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 3 }, alternateRowStyles: { fillColor: [245, 245, 245] },
      });

      doc.setFontSize(11);
      doc.text('DESEMPENO POR ISLA', 14, doc.lastAutoTable.finalY + 10);
      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 13,
        head: [['Isla', 'Litros Vendidos']],
        body: Object.entries(stats.islandLiters).map(([id, liters]) => [`Isla ${id}`, formatNumber(liters, 0)]),
        theme: 'grid', headStyles: { fillColor: [0, 51, 153], textColor: 255, fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 3 }, alternateRowStyles: { fillColor: [245, 245, 245] },
      });

      if (productPieData.length > 0) {
        doc.setFontSize(11);
        doc.text('PRODUCTOS MAS VENDIDOS', 14, doc.lastAutoTable.finalY + 10);
        doc.autoTable({
          startY: doc.lastAutoTable.finalY + 13,
          head: [['Producto', 'Cantidad Vendida']],
          body: productPieData.map((p) => [p.fullName || p.name, p.value.toString()]),
          theme: 'grid', headStyles: { fillColor: [0, 166, 81], textColor: 255, fontSize: 9 },
          styles: { fontSize: 8, cellPadding: 3 }, alternateRowStyles: { fillColor: [245, 245, 245] },
        });
      }

      if (filteredShifts.length > 0) {
        doc.setFontSize(11);
        doc.text('DETALLE DE TURNOS', 14, doc.lastAutoTable.finalY + 10);
        doc.autoTable({
          startY: doc.lastAutoTable.finalY + 13,
          head: [['Fecha', 'Turno', 'Tasa', 'Litros', 'PV USD', 'PV Bs', 'Estado']],
          body: filteredShifts.map((s) => {
            const liters = (s.pumpReadings || []).reduce((sum, r) => sum + (r.litersSold || 0), 0);
            const usd = (s.islands || []).reduce((sum, isl) => sum + (isl.pvTotalUSD || 0), 0);
            const bs = (s.islands || []).reduce((sum, isl) => sum + (isl.pvTotalBs || 0), 0);
            return [s.date || '-', s.operatorShiftType || '-', formatBs(s.tasa1 || 0), formatNumber(liters, 0), formatUSD(usd), formatBs(bs), s.status || '-'];
          }),
          theme: 'grid', headStyles: { fillColor: [206, 17, 38], textColor: 255, fontSize: 8 },
          styles: { fontSize: 7, cellPadding: 2 }, alternateRowStyles: { fillColor: [245, 245, 245] },
        });
      }

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`Pagina ${i} de ${pageCount}  |  PDV Estacion de Servicio`, 148.5, 200, { align: 'center' });
      }

      doc.save(`reporte_estacion_${fecha.replace(/\//g, '-')}.pdf`);
      enqueueSnackbar({ message: 'PDF generado exitosamente', variant: 'success' });
    } catch (err) {
      console.error('PDF error:', err);
      enqueueSnackbar({ message: 'Error al generar PDF: ' + err.message, variant: 'error' });
    }
  }, [stats, users, activeProducts, filteredShifts, productPieData, config.tasa1]);

  const shareWhatsApp = useCallback(() => {
    const fecha = getVenezuelaDateString();
    const text = `*REPORTE DE ESTACION*\n_Fecha: ${fecha}_\n\n*RESUMEN:*\n- Turnos cerrados: ${filteredShifts.length}\n- Litros totales: ${formatNumber(stats.totalLiters, 0)} L\n- Ingresos USD: ${formatUSD(stats.totalUSD)}\n- Ingresos Bs: ${formatBs(stats.totalBs)}\n- Productos vendidos: ${formatUSD(stats.totalProductsUSD)}\n\n*POR ISLA:*\n${Object.entries(stats.islandLiters).map(([id, liters]) => `- Isla ${id}: ${formatNumber(liters, 0)} L`).join('\n')}\n\n*Tasa BCV: ${config.tasa1 || 0} Bs/$*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    enqueueSnackbar({ message: 'Abriendo WhatsApp...', variant: 'info' });
  }, [stats, filteredShifts, config.tasa1]);

  const chartSection = (children) => (
    <Box sx={{
      animation: 'fadeIn 0.4s ease',
      '@keyframes fadeIn': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
    }}>{children}</Box>
  );

  const chartH = isMobile ? 260 : 340;
  const chartHLarge = isMobile ? 280 : 400;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: isMobile ? 2 : 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight={700}>Dashboard</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: isXs ? '0.75rem' : undefined }}>
            Panel de control del administrador
          </Typography>
        </Box>
      </Box>

      <Card sx={{ mb: isMobile ? 1.5 : 2.5, borderRadius: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 1 : 2, flexWrap: 'wrap' }}>
            <FilterListIcon sx={{ color: COLORS.secondary, fontSize: 20 }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: isXs ? '0.65rem' : undefined }}>
              Filtrar por fecha:
            </Typography>
            <TextField
              size="small" type="date" label="Desde" value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ maxWidth: isMobile ? 130 : 170, flex: isMobile ? 1 : 'none' }}
            />
            <TextField
              size="small" type="date" label="Hasta" value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ maxWidth: isMobile ? 130 : 170, flex: isMobile ? 1 : 'none' }}
            />
            {(dateFrom || dateTo) && (
              <Button size="small" onClick={() => { setDateFrom(''); setDateTo(''); }} sx={{ color: COLORS.grey, fontSize: '0.72rem' }}>
                Limpiar filtro
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={isMobile ? 1.5 : 2.5} sx={{ mb: isMobile ? 1.5 : 3 }}>
        <Grid item xs={6} sm={3}>
          <StatCard label="Usuarios" value={users.length} icon={<PeopleIcon />} color={COLORS.primary}
            subtitle={`${users.filter((u) => u.role === 'administrador').length} admins / ${users.filter((u) => u.role === 'supervisor').length} superv`}
            isMobile={isMobile} isXs={isXs} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="Productos Activos" value={activeProducts.length} icon={<CategoryIcon />} color={COLORS.secondary}
            subtitle={`de ${products.length} totales`} isMobile={isMobile} isXs={isXs} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="Litros Totales" value={formatNumber(stats.totalLiters, 0) + ' L'} icon={<LocalGasStationIcon />} color={COLORS.accent}
            subtitle={`${filteredShifts.length} turnos`} isMobile={isMobile} isXs={isXs} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="Ingresos USD" value={formatUSD(stats.totalUSD)} icon={<AttachMoneyIcon />} color={COLORS.success}
            subtitle={`+ ${formatUSD(stats.totalProductsUSD)} prod`} isMobile={isMobile} isXs={isXs} />
        </Grid>
      </Grid>

      <Grid container spacing={isMobile ? 1.5 : 2.5} sx={{ mb: isMobile ? 1.5 : 3 }}>
        <Grid item xs={6} sm={4}>
          <StatCard label="Ingresos Bolivares" value={formatBs(stats.totalBs)} icon={<TrendingUpIcon />} color={COLORS.purple}
            subtitle={`Tasa: ${config.tasa1 || 0} Bs/$`} isMobile={isMobile} isXs={isXs} />
        </Grid>
        <Grid item xs={6} sm={4}>
          <StatCard label="Turnos Cerrados" value={closedShifts.length} icon={<SpeedIcon />} color={COLORS.orange}
            subtitle={filteredShifts.length !== closedShifts.length ? `${filteredShifts.length} en periodo` : 'Total historico'}
            isMobile={isMobile} isXs={isXs} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard label="Tasa BCV" value={`Bs. ${config.tasa1 || 0}`} icon={<TrendingUpIcon />} color={COLORS.accent}
            subtitle={config.tasa2 ? `Premium: Bs. ${config.tasa2}` : 'Solo regular'} isMobile={isMobile} isXs={isXs} />
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', gap: isMobile ? 1 : 1.5, mb: isMobile ? 1.5 : 3, flexWrap: 'wrap' }}>
        <Button variant="contained" startIcon={<FileDownloadIcon />} onClick={generatePDF}
          sx={{ borderRadius: 2, px: isMobile ? 2 : 3, py: 1, fontWeight: 600, textTransform: 'none', fontSize: isMobile ? '0.8rem' : undefined }}>
          Exportar PDF
        </Button>
        <Button variant="contained" startIcon={<WhatsAppIcon />} onClick={shareWhatsApp}
          sx={{ background: '#25D366', borderRadius: 2, px: isMobile ? 2 : 3, py: 1, fontWeight: 600, textTransform: 'none', fontSize: isMobile ? '0.8rem' : undefined, '&:hover': { background: '#1da851' } }}>
          {isMobile ? 'WhatsApp' : 'Enviar por WhatsApp'}
        </Button>
      </Box>

      <Card sx={{ mb: isMobile ? 1.5 : 3, borderRadius: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons={isMobile ? 'auto' : undefined}
          sx={{
            px: isMobile ? 1 : 2, pt: 1,
            '& .MuiTab-root': { color: 'text.secondary', fontWeight: 600, fontSize: isXs ? '0.68rem' : '0.8rem', textTransform: 'none', minWidth: isMobile ? 'auto' : undefined },
            '& .MuiTab-root.Mui-selected': { color: COLORS.primary },
            '& .MuiTabs-indicator': { backgroundColor: COLORS.primary },
          }}
        >
          <Tab label={isMobile ? 'Isla' : 'Ventas por Isla'} />
          <Tab label={isMobile ? 'Tendencia' : 'Tendencia Diaria'} />
          <Tab label="Ingresos" />
          <Tab label="Productos" />
          <Tab label="Turnos" />
        </Tabs>
      </Card>

      <Box ref={chartsRef}>
        {tabValue === 0 && chartSection(
          <Grid container spacing={isMobile ? 1.5 : 2.5}>
            <Grid item xs={12} md={8}>
              <ChartCard title="Ventas por Isla (Litros y USD)" isMobile={isMobile}>
                <ResponsiveContainer width="100%" height={chartH}>
                  <BarChart data={islandBarData} margin={{ top: 10, right: isMobile ? 10 : 20, left: isMobile ? -10 : 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis dataKey="name" tick={{ fill: CHART_TEXT, fontSize: isXs ? 10 : 12 }} />
                    <YAxis tick={{ fill: CHART_TEXT, fontSize: isXs ? 10 : 11 }} />
                    <RechartsTooltip content={<ChartTooltipContent />} />
                    <Legend wrapperStyle={{ fontSize: isXs ? 10 : 12 }} />
                    <Bar dataKey="Litros" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="USD ($)" fill={COLORS.secondary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </Grid>
            <Grid item xs={12} md={4}>
              <ChartCard title="Distribucion por Turno" isMobile={isMobile}>
                <ResponsiveContainer width="100%" height={chartH}>
                  <PieChart>
                    <Pie data={shiftTypePieData} cx="50%" cy="50%" innerRadius={isMobile ? 40 : 55} outerRadius={isMobile ? 70 : 90} paddingAngle={4} dataKey="value"
                      label={isMobile ? false : ({ name, value }) => `${name} (${value})`}>
                      {shiftTypePieData.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? COLORS.accent : COLORS.secondary} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<ChartTooltipContent />} />
                    <Legend verticalAlign="bottom" iconType="circle" formatter={(value) => <span style={{ fontSize: isXs ? 11 : 13 }}>{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </Grid>
          </Grid>
        )}

        {tabValue === 1 && chartSection(
          <ChartCard title="Tendencia de Litros Diarios (ultimos 14 dias)" isMobile={isMobile}>
            <ResponsiveContainer width="100%" height={chartHLarge}>
              <AreaChart data={dailyAreaData} margin={{ top: 10, right: isMobile ? 5 : 20, left: isMobile ? -15 : 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="litersGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="date" tick={{ fill: CHART_TEXT, fontSize: isXs ? 8 : 10 }} angle={isMobile ? -45 : -25} textAnchor="end" height={isMobile ? 60 : 50} />
                <YAxis tick={{ fill: CHART_TEXT, fontSize: isXs ? 10 : 11 }} />
                <RechartsTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="Litros" stroke={COLORS.primary} strokeWidth={2.5} fill="url(#litersGrad)"
                  dot={{ r: 4, fill: COLORS.primary, stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: COLORS.secondary, stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {tabValue === 2 && chartSection(
          <ChartCard title="Ingresos Diarios en Bolivares (ultimos 14 dias)" isMobile={isMobile}>
            <ResponsiveContainer width="100%" height={chartHLarge}>
              <LineChart data={revenueLineData} margin={{ top: 10, right: isMobile ? 5 : 20, left: isMobile ? -15 : 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="date" tick={{ fill: CHART_TEXT, fontSize: isXs ? 8 : 10 }} angle={isMobile ? -45 : -25} textAnchor="end" height={isMobile ? 60 : 50} />
                <YAxis tick={{ fill: CHART_TEXT, fontSize: isXs ? 10 : 11 }} />
                <RechartsTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="Ingresos (Bs)" stroke={COLORS.success} strokeWidth={2.5}
                  dot={{ r: 4, fill: COLORS.success, stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: COLORS.accent, stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {tabValue === 3 && chartSection(
          <Grid container spacing={isMobile ? 1.5 : 2.5}>
            <Grid item xs={12} md={6}>
              <ChartCard title="Productos Mas Vendidos" isMobile={isMobile}>
                <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
                  <PieChart>
                    <Pie data={productPieData} cx="50%" cy="50%" outerRadius={isMobile ? 80 : 110} paddingAngle={3} dataKey="value"
                      label={isMobile ? false : ({ name, value }) => `${name}: ${value}`} labelLine={{ strokeWidth: 1 }}>
                      {productPieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<ChartTooltipContent />} />
                    {isMobile && (
                      <Legend verticalAlign="bottom" iconType="circle" formatter={(value) => <span style={{ fontSize: 10 }}>{value}</span>} />
                    )}
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </Grid>
            <Grid item xs={12} md={6}>
              <ChartCard title="Ranking de Productos" isMobile={isMobile}>
                <Box sx={{ maxHeight: isMobile ? 280 : 350, overflow: 'auto' }}>
                  {productPieData.length === 0 ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 250 }}>
                      <Typography variant="body2" color="text.secondary">Sin datos de productos vendidos</Typography>
                    </Box>
                  ) : productPieData.map((p, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 1 : 1.5, p: isMobile ? 1 : 1.5, borderBottom: '1px solid #F0F0F0', '&:hover': { bgcolor: '#FAFAFA' } }}>
                      <Box sx={{ width: isMobile ? 6 : 8, height: isMobile ? 6 : 8, borderRadius: '50%', bgcolor: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ flex: 1, fontSize: isXs ? '0.75rem' : '0.85rem' }}>{p.fullName || p.name}</Typography>
                      <Chip label={`${p.value} uds`} size="small" sx={{
                        bgcolor: `${PIE_COLORS[i % PIE_COLORS.length]}15`, color: PIE_COLORS[i % PIE_COLORS.length], fontWeight: 700, fontSize: isXs ? '0.65rem' : '0.72rem',
                      }} />
                    </Box>
                  ))}
                </Box>
              </ChartCard>
            </Grid>
          </Grid>
        )}

        {tabValue === 4 && chartSection(
          <ChartCard title="Detalle de Turnos Cerrados" isMobile={isMobile}>
            {filteredShifts.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 250 }}>
                <Typography variant="body2" color="text.secondary">
                  No hay turnos cerrados{dateFrom || dateTo ? ' en el periodo seleccionado' : ''}
                </Typography>
              </Box>
            ) : (
              <TableContainer sx={{ maxHeight: isMobile ? 400 : 500 }}>
                <Table size="small" sx={{ minWidth: isMobile ? 550 : undefined }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Turno</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Tasa</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Litros</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">PV USD</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">PV Bs</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="center">Estado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredShifts.map((shift) => {
                      const liters = (shift.pumpReadings || []).reduce((sum, r) => sum + (r.litersSold || 0), 0);
                      const usd = (shift.islands || []).reduce((sum, isl) => sum + (isl.pvTotalUSD || 0), 0);
                      const bs = (shift.islands || []).reduce((sum, isl) => sum + (isl.pvTotalBs || 0), 0);
                      return (
                        <TableRow key={shift.id} hover>
                          <TableCell>{shift.date}</TableCell>
                          <TableCell>
                            <Chip label={shift.operatorShiftType || '-'} size="small" sx={{
                              bgcolor: shift.operatorShiftType === 'DIURNO' ? `${COLORS.accent}20` : `${COLORS.secondary}15`,
                              color: shift.operatorShiftType === 'DIURNO' ? '#B8860B' : COLORS.secondary, fontWeight: 600, fontSize: '0.72rem',
                            }} />
                          </TableCell>
                          <TableCell align="right">{formatBs(shift.tasa1 || 0)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>{formatNumber(liters, 0)} L</TableCell>
                          <TableCell align="right" sx={{ color: COLORS.success, fontWeight: 600 }}>{formatUSD(usd)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>{formatBs(bs)}</TableCell>
                          <TableCell align="center">
                            <Chip label={shift.status === 'cerrado' ? 'Cerrado' : 'En Progreso'} size="small" sx={{
                              bgcolor: shift.status === 'cerrado' ? `${COLORS.success}15` : `${COLORS.orange}15`,
                              color: shift.status === 'cerrado' ? COLORS.success : COLORS.orange, fontWeight: 600, fontSize: '0.72rem',
                            }} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </ChartCard>
        )}
      </Box>
    </Box>
  );
}