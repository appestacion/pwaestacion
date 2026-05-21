// src/components/UserManual.jsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Divider,
  Button,
  useMediaQuery,
  useTheme,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SpeedIcon from '@mui/icons-material/Speed';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import BookIcon from '@mui/icons-material/Book';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import InventoryIcon from '@mui/icons-material/Inventory';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import DescriptionIcon from '@mui/icons-material/Description';
import BarChartIcon from '@mui/icons-material/BarChart';
import HistoryIcon from '@mui/icons-material/History';
import PaymentsIcon from '@mui/icons-material/Payments';
import LockResetIcon from '@mui/icons-material/LockReset';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useConfigStore } from '../store/useConfigStore.js';

// ═══════════════════════════════════════════════════════════
// SECCIÓN DEL MANUAL
// ═══════════════════════════════════════════════════════════
function ManualSection({ number, icon, title, children }) {
  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            bgcolor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main', lineHeight: 1.2 }}>
            {number}. {title}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ pl: { xs: 0, sm: '52px' } }}>
        {children}
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════
// PÁRRAFO ESTILIZADO
// ═══════════════════════════════════════════════════════════
function P({ children, bold }) {
  return (
    <Typography
      variant="body2"
      sx={{
        mb: 1.5,
        lineHeight: 1.7,
        color: 'text.primary',
        fontWeight: bold ? 600 : 400,
        fontSize: '0.875rem',
      }}
    >
      {children}
    </Typography>
  );
}

// ═══════════════════════════════════════════════════════════
// PASO INSTRUCCIÓN
// ═══════════════════════════════════════════════════════════
function Step({ num, children }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'flex-start' }}>
      <Box
        sx={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          bgcolor: 'primary.light',
          color: 'primary.main',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          fontWeight: 700,
          flexShrink: 0,
          mt: 0.2,
        }}
      >
        {num}
      </Box>
      <Typography variant="body2" sx={{ lineHeight: 1.7, color: 'text.primary', fontSize: '0.875rem' }}>
        {children}
      </Typography>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════
// TIP / ADVERTENCIA / NOTA
// ═══════════════════════════════════════════════════════════
function Tip({ children }) {
  return (
    <Alert
      severity="info"
      icon={<InfoIcon />}
      sx={{ mb: 2, borderRadius: 2, '& .MuiAlert-message': { fontSize: '0.82rem', lineHeight: 1.7 } }}
    >
      {children}
    </Alert>
  );
}

function Warning({ children }) {
  return (
    <Alert
      severity="warning"
      icon={<WarningAmberIcon />}
      sx={{ mb: 2, borderRadius: 2, '& .MuiAlert-message': { fontSize: '0.82rem', lineHeight: 1.7 } }}
    >
      {children}
    </Alert>
  );
}

function Success({ children }) {
  return (
    <Alert
      severity="success"
      icon={<CheckCircleIcon />}
      sx={{ mb: 2, borderRadius: 2, '& .MuiAlert-message': { fontSize: '0.82rem', lineHeight: 1.7 } }}
    >
      {children}
    </Alert>
  );
}

// ═══════════════════════════════════════════════════════════
// SUBTÍTULO
// ═══════════════════════════════════════════════════════════
function Sub({ children }) {
  return (
    <Typography
      variant="body2"
      sx={{ fontWeight: 700, mb: 1, mt: 2, color: 'text.secondary', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 0.5 }}
    >
      {children}
    </Typography>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function UserManual({ open, onClose }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const config = useConfigStore((state) => state.config);
  const stationName = config.stationName || 'Estacion de Servicio';

  const handleDownloadPDF = () => {
    generateManualPDF(stationName);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth="md"
      fullWidth
      scroll="paper"
      PaperProps={{
        sx: { borderRadius: fullScreen ? 0 : 3, maxHeight: '92vh' },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          zIndex: 2,
          borderRadius: fullScreen ? 0 : '12px 12px 0 0',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MenuBookIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Manual de Usuario - Supervisor
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<PictureAsPdfIcon />}
            onClick={handleDownloadPDF}
            sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.78rem' }}
          >
            Descargar PDF
          </Button>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 2, sm: 3, md: 4 } }}>

        {/* PORTADA */}
        <Box sx={{ textAlign: 'center', mb: 4, py: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main', mb: 1 }}>
            {stationName}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            Manual de Usuario - Supervisor
          </Typography>
          <Chip label="Sistema de Cierre de Turno v1.0" color="primary" variant="outlined" sx={{ fontWeight: 600 }} />
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
            Documento de referencia para el uso completo del sistema de gestion de estacion de servicio.
            Contiene instrucciones detalladas paso a paso para todas las funciones disponibles para el rol de Supervisor.
          </Typography>
        </Box>

        <Divider sx={{ mb: 4 }} />

        {/* ─── ÍNDICE ─── */}
        <ManualSection number="0" icon={<MenuBookIcon fontSize="small" />} title="Indice de Contenidos">
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
            <Table size="small">
              <TableBody>
                {[
                  ['1', 'Dashboard (Pantalla Principal)', 'Resumen del sistema y creacion de turnos'],
                  ['2', 'Recepcion de Gandola', 'Registro de descarga de combustible'],
                  ['3', 'Gastos del Turno', 'Registro de gastos en Bolivares'],
                  ['4', 'Lecturas', 'Lecturas de bombas, tanques y tasas de cambio'],
                  ['5', 'Cierre de Turno', 'Registro completo de cortes, PV, vales y productos'],
                  ['6', 'Reporte de Lectura y Recepcion', 'Vista consolidada diurno/nocturno'],
                  ['7', 'Biblia (Resumen Financiero)', 'Calculo de propina y balance por isla'],
                  ['8', 'Cuadre PV (Punto de Venta)', 'Conciliacion de punto de venta'],
                  ['9', 'Inventario', 'Gestion de stock general y por isla'],
                  ['10', 'Historial de Cierres', 'Consulta de turnos cerrados anteriores'],
                  ['11', 'Generar PDF', 'Descarga e impresion de reportes'],
                  ['12', 'Estadisticas', 'Graficos y metricas de rendimiento'],
                  ['13', 'Cuenta y Seguridad', 'Cambio de contrasena y cierre de sesion'],
                ].map(([num, titulo, desc]) => (
                  <TableRow key={num} hover>
                    <TableCell sx={{ fontWeight: 700, width: 40, pl: 2 }}>{num}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{titulo}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{desc}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </ManualSection>

        <Divider sx={{ my: 3 }} />

        {/* ═══════════════════════════════════════════════════════ */}
        {/* SECCION 1: DASHBOARD */}
        {/* ═══════════════════════════════════════════════════════ */}
        <ManualSection number="1" icon={<DashboardIcon fontSize="small" />} title="Dashboard (Pantalla Principal)">
          <P>
            El Dashboard es la primera pantalla que ve el supervisor al iniciar sesion. Desde aqui puede ver un resumen rapido del estado actual del sistema, crear nuevos turnos de trabajo y acceder rapidamente a las funciones principales.
          </P>

          <Sub>Turnos de Supervisor</Sub>
          <P>
            El sistema maneja dos turnos de supervisor (TS) que cubren todo el dia:
          </P>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Turno Supervisor</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Horario</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Cierra el turno operador</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell><Chip label="1TS" color="primary" size="small" /></TableCell>
                  <TableCell>6:00 AM - 2:00 PM</TableCell>
                  <TableCell>2TO Nocturno (7:00 PM - 7:00 AM)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Chip label="2TS" color="secondary" size="small" /></TableCell>
                  <TableCell>2:00 PM - 10:00 PM</TableCell>
                  <TableCell>1TO Diurno (7:00 AM - 7:00 PM)</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <Sub>Crear un Nuevo Turno</Sub>
          <Step num={1}>Desde el Dashboard, seleccione el turno supervisor correspondiente (1TS o 2TS) haciendo clic en la tarjeta que indica el turno.</Step>
          <Step num={2}>El sistema creara automaticamente el turno con las lecturas iniciales heredadas del turno anterior cerrado del operador correspondiente. Esto significa que la lectura final del turno anterior se convierte automaticamente en la lectura inicial del nuevo turno.</Step>
          <Step num={3}>Una vez creado, aparecera un indicador "Turno Activo" en la barra superior (Topbar) y podra comenzar a registrar datos.</Step>

          <Tip>Los turnos se guardan automaticamente en la nube. Si pierde conexion, los datos se sincronizan cuando se restaura la conexion. Verifique que el icono de nube verde este visible en la barra superior.</Tip>

          <Sub>Acciones Rapidas</Sub>
          <P>
            Cuando hay un turno activo, el Dashboard muestra tarjetas con el resumen de litros vendidos por isla y botones de acceso rapido a: Lecturas, Cierre de Turno, Gastos, Biblia, Cuadre PV y Generar PDF. Estas tarjetas permiten navegar directamente a la funcion deseada sin usar el menu lateral.
          </P>

          <Warning>No puede tener dos turnos activos simultaneamente. Debe cerrar el turno actual antes de crear uno nuevo. Si por error queda un turno abierto de un dia anterior, puede cerrarlo desde la seccion de Cierre de Turno.</Warning>
        </ManualSection>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* SECCION 2: RECEPCION GANDOLA */}
        {/* ═══════════════════════════════════════════════════════ */}
        <ManualSection number="2" icon={<LocalShippingIcon fontSize="small" />} title="Recepcion de Gandola">
          <P>
            Esta seccion permite registrar la descarga de combustible desde una gandola (camion cisterna) a los tanques de almacenamiento de la estacion. Es un proceso critico que afecta directamente el inventario y los calculos de ventas.
          </P>

          <Sub>Proceso de Recepcion</Sub>
          <Step num={1}>Haga clic en "Nueva Recepcion" para iniciar el registro.</Step>
          <Step num={2}>Seleccione el supervisor que realiza la recepcion del listado desplegable.</Step>
          <Step num={3}>Complete los datos del conductor: nombre completo y numero de cedula de identidad (CI).</Step>
          <Step num={4}>Registre la hora de llegada y la hora de salida de la gandola.</Step>
          <Step num={5}>Ingrese los litros recibidos en cada compartimento de la gandola (generalmente 1, 2 o 3 compartimentos).</Step>
          <Step num={6}>Para cada tanque de almacenamiento, registre la lectura en centimetros (CM) ANTES de la descarga. El sistema convierte automaticamente los centimetros a litros usando la tabla de calibracion.</Step>
          <Step num={7}>Una vez finalizada la descarga, registre la lectura en centimetros DESPUES para cada tanque. El sistema calcula automaticamente la diferencia de litros.</Step>

          <Sub>Sugerencias de Descarga</Sub>
          <P>
            El sistema genera automaticamente sugerencias de distribucion de combustible a los tanques, considerando la capacidad restante de cada tanque. Las sugerencias aparecen como tarjetas y recomiendan a que tanque descargar cada compartimento. Las cantidades sugeridas se redondean a multiplos de 1.000 litros para facilitar la operacion.
          </P>

          <Tip>Si la gandola trae un tipo de producto diferente (por ejemplo, Gasolina 95 en vez de 91), registre el tipo de producto en el campo "Tipo de Producto" para llevar un control adecuado del inventario por tipo de combustible.</Tip>

          <Warning>Las lecturas de tanque deben tomarse con el metro mecanico directamente en el tanque. Los valores en centimetros deben corresponder exactamente a los valores de la tabla de calibracion (incrementos de 0.5 cm). Si ingresa un valor que no esta en la tabla, el sistema mostrara 0 litros.</Warning>

          <Sub>Finalizar o Cancelar</Sub>
          <P>Al finalizar, puede "Cerrar Recepcion" para guardar el registro completo, o "Cancelar" para eliminar la recepcion en curso. Una vez cerrada, la recepcion queda almacenada y puede ser consultada desde el Reporte de Lectura y Recepcion.</P>
        </ManualSection>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* SECCION 3: GASTOS */}
        {/* ═══════════════════════════════════════════════════════ */}
        <ManualSection number="3" icon={<PaymentsIcon fontSize="small" />} title="Gastos del Turno">
          <P>
            Esta seccion permite registrar todos los gastos incurridos durante el turno en Bolivares (Bs.). Los gastos se incluyen en la Biblia (resumen financiero) y se utilizan para calcular la propina real del operador. Los gastos se ingresan en Bs. y el sistema los convierte automaticamente a USD usando la tasa del dia.
          </P>

          <Sub>Registrar un Gasto</Sub>
          <Step num={1}>Ingrese el monto del gasto en Bolivares en el campo de texto. Use el formato numerico con decimales (por ejemplo: 150,50).</Step>
          <Step num={2}>Escriba una descripcion breve del gasto (por ejemplo: "Compra de aceite para bomba", "Pago electrico", "Reparacion surtidor").</Step>
          <Step num={3}>El gasto se guarda automaticamente. El sistema muestra la conversion a USD al lado del monto en Bs.</Step>

          <Sub>Eliminar un Gasto</Sub>
          <Step num={1}>Cada gasto registrado aparece como una tarjeta con el monto y la descripcion.</Step>
          <Step num={2}>Haga clic en el boton rojo de eliminar (icono de papelera) para quitar el gasto de la lista.</Step>

          <Tip>Todos los gastos se muestran en la Biblia como lineas individuales en el Resumen. Esto permite al operador y al supervisor ver exactamente que gastos se descuentan del total de ingresos para calcular la propina.</Tip>
        </ManualSection>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* SECCION 4: LECTURAS */}
        {/* ═══════════════════════════════════════════════════════ */}
        <ManualSection number="4" icon={<SpeedIcon fontSize="small" />} title="Lecturas">
          <P>
            La seccion de Lecturas es donde se registran las lecturas de los contadores de las bombas (surtidores), las medidas de los tanques de almacenamiento, y las tasas de cambio del dia. Esta informacion es fundamental para calcular los litros vendidos y el inventario disponible.
          </P>

          <Sub>Lecturas de Bombas (Surtidores)</Sub>
          <P>
            Cada isla tiene surtidores (bombas) que miden el combustible despachado. Para cada surtidor debe registrar dos lecturas:
          </P>
          <Step num={1}><strong>Lectura Inicial:</strong> Es la lectura del contador al inicio del turno. Normalmente esta se hereda automaticamente del turno anterior (la lectura final del turno anterior se convierte en la lectura inicial del turno actual).</Step>
          <Step num={2}><strong>Lectura Final:</strong> Es la lectura del contador al cierre del turno. Se obtiene leyendo directamente el display del surtidor.</Step>
          <Step num={3}>El sistema calcula automaticamente los <strong>Litros Vendidos</strong> restando la lectura inicial de la lectura final (Lectura Final - Lectura Inicial).</Step>

          <Tip>Verifique que las lecturas heredadas automaticamente coincidan con el display fisico del surtidor. Si hay discrepancia, corrija la lectura inicial manualmente antes de ingresar la lectura final. Esto puede ocurrir si el medidor fue manipulado o si hubo un error en el cierre anterior.</Tip>

          <Sub>Lecturas de Tanques</Sub>
          <Step num={1}>Tome la medida con el metro mecanico en cada tanque de almacenamiento.</Step>
          <Step num={2}>Ingrese el valor en centimetros (CM) en el campo correspondiente.</Step>
          <Step num={3}>El sistema convierte automaticamente el valor a litros usando la tabla de calibracion de tanques (tabla CM a Litros).</Step>
          <Step num={4}>Puede compartir las lecturas de tanques por WhatsApp haciendo clic en el boton de compartir, lo cual genera un mensaje con el inventario actual.</Step>

          <Warning>La tabla de calibracion tiene incrementos de 0.5 cm (0.5, 1.0, 1.5, 2.0 ... hasta 230 cm). Solo se aceptan valores exactos de la tabla. Si ingresa un valor intermedio (por ejemplo 3.7 cm), el sistema no podra convertirlo y mostrara 0 litros. Redondee al valor mas cercano de la tabla.</Warning>

          <Sub>Tasas de Cambio</Sub>
          <P>Las tasas de cambio son esenciales para convertir entre Bolivares y Dolares:</P>
          <Step num={1}><strong>Tasa 1:</strong> Es la tasa principal del dia. Se utiliza para todos los calculos de conversion Bs. a USD en el turno.</Step>
          <Step num={2}><strong>Tasa 2 (solo para turno nocturno):</strong> Se habilita unicamente cuando el turno activo es el 2TO Nocturno. Se utiliza para los pagos con punto de venta (PV) que se realizan con una tasa diferente a la Tasa 1.</Step>

          <Success>Las tasas se actualizan automaticamente todos los dias a las 11:45 PM (hora de Venezuela) consultando la tasa oficial del BCV. La Tasa 2 se promociona automaticamente a Tasa 1 al inicio del turno 2TS.</Success>
        </ManualSection>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* SECCION 5: CIERRE DE TURNO */}
        {/* ═══════════════════════════════════════════════════════ */}
        <ManualSection number="5" icon={<ReceiptLongIcon fontSize="small" />} title="Cierre de Turno">
          <P>
            Esta es la seccion mas completa y critica del sistema. Aqui se registran todos los datos financieros del turno por cada isla: los cortes en efectivo (Bs. y USD), los pagos con punto de venta (PV), los vales, las transferencias y los productos vendidos. El cierre de turno debe ser meticuloso ya que afecta directamente la Biblia (calculo de propina) y los reportes generados.
          </P>

          <Sub>Navegacion por Pestañas</Sub>
          <P>Los datos se organizan por isla. Cada isla tiene su propia pestana. Si la estacion tiene 3 islas, vera 3 pestanas (Isla 1, Isla 2, Isla 3). Haga clic en cada pestana para ver y editar los datos de esa isla.</P>

          <Sub>Registro de Cortes en Efectivo</Sub>
          <P>Los cortes son los pagos en efectivo que recibe el operador. Se dividen en dos secciones:</P>
          <Step num={1}><strong>Cortes en Bolivares (Bs.):</strong> Ingrese cada corte en el campo correspondiente. El numero maximo de cortes se configura en la seccion de Configuracion (por defecto 12). Solo ingrese los cortes que realmente se hicieron; deje en 0 los campos vacios.</Step>
          <Step num={2}><strong>Cortes en Dolares (USD):</strong> Igualmente, ingrese cada corte en dolares recibido.</Step>
          <Step num={3}><strong>UE (Unidades Extra):</strong> Si el operador recibio efectivo adicional que no corresponde a un corte (por ejemplo, un cliente pago con un billete grande y dejo sobrante), registre el monto en UE Bs. o UE USD segun la moneda.</Step>
          <Step num={4}>El sistema muestra automaticamente el total de Bs. y USD para cada isla.</Step>

          <Sub>Punto de Venta (PV)</Sub>
          <P>Los pagos con punto de venta (tarjeta de debito/credito) se registran por isla:</P>
          <Step num={1}>En la seccion "Punto de Venta 1", ingrese hasta 3 montos en Bs. que representan las transacciones con tarjeta. El sistema calcula automaticamente el equivalente en USD usando la Tasa 1.</Step>
          <Step num={2}>Para el turno nocturno, aparece una seccion adicional "Punto de Venta 2" con la Tasa 2.</Step>
          <Step num={3}>Los totales de PV se reflejan en el Cuadre PV y en la Biblia.</Step>

          <Tip>El PV se calcula como: Monto Bs. / Tasa = Monto USD. Los litros equivalentes se calculan como: USD / Precio por Litro. Por ejemplo, si el precio es $0.50/litro, entonces $2.00 / $0.50 = 4 litros. El precio por litro se configura desde la seccion de Configuracion (admin).</Tip>

          <Sub>Vales</Sub>
          <P>Los vales son comprobantes de pago que otorgan terceros (por ejemplo, empresas, flotas corporativas):</P>
          <Step num={1}>Haga clic en "Agregar Vale" para crear un nuevo registro.</Step>
          <Step num={2}>Ingrese el monto del vale en USD y una descripcion (por ejemplo: "Vale Corpoelec", "Vale Movilnet").</Step>
          <Step num={3}>Puede agregar multiples vales por isla. Para eliminar un vale, haga clic en el boton de eliminar.</Step>

          <Sub>Transferencias</Sub>
          <P>Las transferencias son depositos o pagos electronicos recibidos:</P>
          <Step num={1}>Haga clic en "Agregar Transferencia" para crear un nuevo registro.</Step>
          <Step num={2}>Ingrese el monto en USD y la descripcion (por ejemplo: "Transferencia Banco de Venezuela", "Pago Movil").</Step>
          <Step num={3}>Puede agregar multiples transferencias por isla.</Step>

          <Sub>Productos Vendidos</Sub>
          <P>Registre los productos (aditivos, aceites, refrigerantes, etc.) vendidos durante el turno:</P>
          <Step num={1}>Seleccione el producto del listado desplegable.</Step>
          <Step num={2}>Ingrese la cantidad vendida.</Step>
          <Step num={3}>Seleccione el metodo de pago: Punto de Venta (PV), Efectivo en Bolivares, o Efectivo en Dolares.</Step>
          <Step num={4}>El sistema registra la venta y la asocia a la isla correspondiente. Los productos vendidos se reflejan en el inventario.</Step>

          <Warning>Todos los cambios se guardan automaticamente cada 2 segundos (ver indicador "Guardado" en verde). Sin embargo, no cierre el navegador mientras este editando. Espere a ver el indicador de guardado antes de cambiar de seccion o cerrar el turno.</Warning>
        </ManualSection>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* SECCION 6: REPORTE */}
        {/* ═══════════════════════════════════════════════════════ */}
        <ManualSection number="6" icon={<DescriptionIcon fontSize="small" />} title="Reporte de Lectura y Recepcion">
          <P>
            El Reporte muestra una vista consolidada de las lecturas del dia en un formato de tres columnas: lecturas del turno diurno (7:00 AM - 7:00 PM) a la izquierda, inventario de tanques en el centro, y lecturas del turno nocturno (7:00 PM - 7:00 AM) a la derecha.
          </P>

          <Sub>Interpretacion de las Columnas</Sub>
          <Step num={1}><strong>Columna izquierda (Diurno):</strong> Muestra las lecturas de bombas del turno diurno para cada isla. Incluye lectura inicial, lectura final y litros vendidos por surtidor, mas el total de litros del turno.</Step>
          <Step num={2}><strong>Columna central (Tanques):</strong> Muestra el inventario de tanques en tres momentos: Inventario Inicial (al inicio del dia), Antes de la Descarga (si hubo gandola), Despues de la Descarga, y el Inventario Final. Tambien muestra el total de litros recibidos por gandola.</Step>
          <Step num={3}><strong>Columna derecha (Nocturno):</strong> Muestra las lecturas del turno nocturno. Si es 1TS (6AM-2PM), esta columna puede mostrar datos del turno nocturno anterior. Si es 2TS (2PM-10PM), esta columna estara en cero ya que el nocturno aun no ha cerrado.</Step>

          <Tip>Este reporte es especialmente util para el supervisor de 1TS, ya que puede ver tanto el turno nocturno cerrado como el diurno cerrado, junto con la recepcion de gandola del dia, todo en una sola pantalla.</Tip>
        </ManualSection>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* SECCION 7: BIBLIA */}
        {/* ═══════════════════════════════════════════════════════ */}
        <ManualSection number="7" icon={<BookIcon fontSize="small" />} title="Biblia (Resumen Financiero)">
          <P>
            La Biblia es el resumen financiero completo del turno. Calcula los ingresos totales por isla, determina la propina del operador y muestra el balance general. Es el documento mas importante del cierre de turno y debe revisarse cuidadosamente antes de generar el PDF.
          </P>

          <Sub>Campos por Isla</Sub>
          <P>Para cada isla se muestran los siguientes campos:</P>
          <Step num={1}><strong>Bs.:</strong> Total de bolivares en efectivo (suma de cortes + UE en Bs.). Se convierte a USD para el calculo.</Step>
          <Step num={2}><strong>$ (USD):</strong> Total de dolares en efectivo (cortes + UE en USD), excluyendo la UE.</Step>
          <Step num={3}><strong>Punto:</strong> Total de pagos con punto de venta en USD (de la seccion PV).</Step>
          <Step num={4}><strong>UE$:</strong> Unidades extra en dolares (si las hay).</Step>
          <Step num={5}><strong>Vale(s):</strong> Total de vales en USD con su descripcion.</Step>
          <Step num={6}><strong>Transferencia(s):</strong> Total de transferencias en USD con su descripcion.</Step>
          <Step num={7}><strong>Propina:</strong> Es la diferencia entre los ingresos totales y el valor de referencia de los litros vendidos (litros vendidos / precio por litro = valor de referencia en USD). Se muestra en Bs. y en USD. El precio por litro se configura en la seccion de Configuracion.</Step>

          <Sub>Resumen General</Sub>
          <P>
            El Resumen consolida los datos de todas las islas mas los gastos del turno. Incluye la suma total de Bs., USD, Punto, UE, Vales, Transferencias y Gastos. El calculo de la propina total se basa en la siguiente formula:
          </P>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#F8F9FA', mb: 2 }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, textAlign: 'center' }}>
              Propina = Ingresos Totales - (Litros Vendidos / Precio por Litro)
            </Typography>
          </Paper>

          <Sub>Sobregiro</Sub>
          <P>
            Cuando la propina es negativa (los ingresos son menores al valor de referencia de los litros), el sistema indica un "Sobregiro". Esto significa que falta dinero. En ese caso, el sistema calcula el "Total a tomar de caja chica", que es la suma del sobregiro mas los gastos del turno.
          </P>

          <Warning>Si hay un sobregiro significativo, revise cuidadosamente los cortes, los valores de UE y los datos del punto de venta antes de proceder. Un sobregiro puede indicar un error en el registro o un faltante real de caja.</Warning>

          <Sub>Comprension (Verificacion)</Sub>
          <P>
            En la parte inferior de la Biblia, el sistema muestra una verificacion que compara los litros vendidos con el total del Resumen convertido a litros (USD / precio por litro). Si ambos valores coinciden, significa que la caja esta cuadrada. Si hay diferencia, indica un sobregiro o un excedente.
          </P>
        </ManualSection>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* SECCION 8: CUADRE PV */}
        {/* ═══════════════════════════════════════════════════════ */}
        <ManualSection number="8" icon={<PointOfSaleIcon fontSize="small" />} title="Cuadre PV (Punto de Venta)">
          <P>
            El Cuadre PV muestra la conciliacion de los pagos con punto de venta (tarjeta) por isla. Presenta los montos en Bs., en USD y los litros equivalentes para cada punto de venta (PV1 y PV2 para turnos nocturnos).
          </P>
          <Sub>Informacion Mostrada</Sub>
          <Step num={1}><strong>Por isla:</strong> Para cada isla se muestra el monto en Bs. de cada PV, el equivalente en USD, y los litros equivalentes (USD / precio por litro).</Step>
          <Step num={2}><strong>Totales:</strong> Al final se muestra el Total Turno con la suma de todas las islas.</Step>
          <Step num={3}><strong>Detalle adicional:</strong> Debajo de cada isla se muestra el detalle de vales, transferencias y productos vendidos si los hay.</Step>

          <Tip>Los litros del PV se calculan como: USD del PV / precio por litro. Si la tasa es 50 Bs./USD, el PV registro 100 Bs. y el precio es $0.50/litro, entonces 100/50 = 2 USD, y 2 / 0.50 = 4 litros. El precio por litro se configura desde la seccion de Configuracion (admin).</Tip>
        </ManualSection>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* SECCION 9: INVENTARIO */}
        {/* ═══════════════════════════════════════════════════════ */}
        <ManualSection number="9" icon={<InventoryIcon fontSize="small" />} title="Inventario">
          <P>
            La seccion de Inventario gestiona el stock de productos (aditivos, aceites, refrigerantes, liquido de freno, extintores) en dos niveles: el inventario general (almacen/cajas) y el inventario por isla (productos distribuidos a cada isla para la venta).
          </P>

          <Sub>Pestana: Inventario General</Sub>
          <P>Muestra todos los productos disponibles en almacen con su cantidad actual. El sistema usa un codigo de colores para indicar el estado del stock:</P>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Color</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Estado</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Significado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow><TableCell><Box sx={{ width: 16, height: 16, borderRadius: '4px', bgcolor: '#F44336' }} /></TableCell><TableCell>Critico</TableCell><TableCell>Stock en 0</TableCell></TableRow>
                <TableRow><TableCell><Box sx={{ width: 16, height: 16, borderRadius: '4px', bgcolor: '#FF9800' }} /></TableCell><TableCell>Bajo</TableCell><TableCell>Stock entre 1 y 3 unidades</TableCell></TableRow>
                <TableRow><TableCell><Box sx={{ width: 16, height: 16, borderRadius: '4px', bgcolor: '#4CAF50' }} /></TableCell><TableCell>Normal</TableCell><TableCell>Stock mayor a 3 unidades</TableCell></TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <Sub>Como Agregar Stock al Almacen</Sub>
          <Step num={1}>Haga clic en el boton "Agregar Stock" en la pestana de Inventario General.</Step>
          <Step num={2}>Seleccione el producto del listado desplegable.</Step>
          <Step num={3}>Ingrese la cantidad a agregar.</Step>
          <Step num={4}>Haga clic en "Agregar" para registrar la entrada de stock.</Step>

          <Sub>Pestana: Inventario por Isla</Sub>
          <P>Muestra los productos distribuidos a cada isla. Aqui puede ver cuanto stock hay en cada punto de venta y realizar operaciones de distribucion y retorno.</P>

          <Sub>Distribuir Productos a una Isla</Sub>
          <Step num={1}>En la pestana "Inventario por Isla", seleccione la isla destino.</Step>
          <Step num={2}>Haga clic en "Distribuir" en el producto que desea enviar a la isla.</Step>
          <Step num={3}>Ingrese la cantidad a distribuir. El sistema verifica que haya stock suficiente en el almacen general.</Step>
          <Step num={4}>La cantidad se descuenta del almacen general y se suma al stock de la isla seleccionada.</Step>

          <Sub>Retornar Productos de una Isla</Sub>
          <Step num={1}>En la pestana "Inventario por Isla", seleccione la isla de origen.</Step>
          <Step num={2}>Haga clic en "Retornar" en el producto que desea devolver al almacen.</Step>
          <Step num={3}>Ingrese la cantidad a retornar. El sistema verifica que haya stock suficiente en la isla.</Step>
          <Step num={4}>La cantidad se descuenta de la isla y se suma al almacen general.</Step>

          <Warning>Todas las operaciones de inventario se realizan en tiempo real. Si hay multiples usuarios conectados, los cambios se sincronizan automaticamente. Evite editar el mismo producto simultaneamente desde dos dispositivos diferentes.</Warning>
        </ManualSection>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* SECCION 10: HISTORIAL */}
        {/* ═══════════════════════════════════════════════════════ */}
        <ManualSection number="10" icon={<HistoryIcon fontSize="small" />} title="Historial de Cierres">
          <P>
            El Historial de Cierres permite consultar todos los turnos cerrados anteriormente. Puede filtrar por fecha y revisar el detalle completo de cualquier turno pasado, incluyendo lecturas, Biblia, Cuadre PV y productos vendidos.
          </P>

          <Sub>Consultar un Turno Anterior</Sub>
          <Step num={1}>Use los selectores de fecha para filtrar los turnos por rango de fechas.</Step>
          <Step num={2}>La tabla muestra todos los turnos cerrados dentro del rango seleccionado, con la fecha, el turno (diurno/nocturno), el supervisor y los litros totales.</Step>
          <Step num={3}>Haga clic en "Ver Detalle" para abrir el reporte completo del turno en un dialogo a pantalla completa.</Step>
          <Step num={4}>Dentro del detalle puede ver todas las secciones: Lecturas, Biblia, Cuadre PV, Inventario y Gastos.</Step>
          <Step num={5}>Tambien puede generar un PDF del turno desde el detalle.</Step>

          <Tip>El historial guarda los ultimos 500 turnos cerrados. Si necesita un turno mas antiguo, contacte al administrador del sistema.</Tip>
        </ManualSection>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* SECCION 11: GENERAR PDF */}
        {/* ═══════════════════════════════════════════════════════ */}
        <ManualSection number="11" icon={<PictureAsPdfIcon fontSize="small" />} title="Generar PDF">
          <P>
            Desde esta seccion puede generar y descargar los reportes del turno activo en formato PDF. El sistema genera los PDFs directamente en el navegador sin necesidad de conexion a internet una vez cargados los datos del turno.
          </P>

          <Sub>Tipos de PDF Disponibles</Sub>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Reporte</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Orientacion</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Contenido</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow><TableCell>Cierre de Turno</TableCell><TableCell>Vertical</TableCell><TableCell>Cortes por isla (Bs. y USD) con totales</TableCell></TableRow>
                <TableRow><TableCell>Reporte Lectura</TableCell><TableCell>Horizontal</TableCell><TableCell>Lecturas diurno, tanques, recepcion gandola y nocturno</TableCell></TableRow>
                <TableRow><TableCell>Biblia</TableCell><TableCell>Vertical</TableCell><TableCell>Resumen financiero, propina y sobregiro</TableCell></TableRow>
                <TableRow><TableCell>Cuadre PV</TableCell><TableCell>Vertical</TableCell><TableCell>Punto de venta por isla con vales y transferencias</TableCell></TableRow>
                <TableRow><TableCell>Todos (PDF Combinado)</TableCell><TableCell>Mixto</TableCell><TableCell>Todos los reportes anteriores en un solo archivo PDF</TableCell></TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <Sub>Como Generar y Descargar</Sub>
          <Step num={1}>Seleccione el reporte que desea generar haciendo clic en la tarjeta correspondiente.</Step>
          <Step num={2}>Haga clic en "Descargar PDF" para obtener el archivo. El PDF se descarga automaticamente a su dispositivo.</Step>
          <Step num={3}>Tambien puede hacer clic en "Imprimir" para enviarlo directamente a una impresora.</Step>
          <Step num={4}>Para "Descargar Todo", el sistema genera un unico PDF con todos los reportes combinados, ideal para archivar el cierre completo del turno.</Step>
        </ManualSection>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* SECCION 12: ESTADISTICAS */}
        {/* ═══════════════════════════════════════════════════════ */}
        <ManualSection number="12" icon={<BarChartIcon fontSize="small" />} title="Estadisticas">
          <P>
            La seccion de Estadisticas muestra graficos y metricas de rendimiento del turno. Permite analizar tendencias de ventas, comparar litros vendidos por isla y revisar los ingresos a lo largo del tiempo.
          </P>

          <Sub>Metricas Principales</Sub>
          <Step num={1}><strong>Total de Turnos:</strong> Cantidad de turnos cerrados en el periodo seleccionado.</Step>
          <Step num={2}><strong>Litros Vendidos:</strong> Total de litros despachados en el periodo.</Step>
          <Step num={3}><strong>Ingresos:</strong> Total de ingresos en USD (suma de cortes, PV, vales, transferencias).</Step>
          <Step num={4}><strong>Propinas:</strong> Total de propinas y el promedio por turno.</Step>
          <Step num={5}><strong>Recepciones de Gandola:</strong> Cantidad de descargas de combustible y total de litros recibidos.</Step>

          <Sub>Filtros de Periodo</Sub>
          <P>Puede filtrar las estadisticas por: Hoy, Esta Semana, Este Mes, o Todos. Los graficos se actualizan automaticamente al cambiar el filtro.</P>

          <Sub>Graficos Disponibles</Sub>
          <P>El sistema muestra graficos de barras (litros por isla), circulares (distribucion de turnos), de lineas (tendencia de litros e ingresos) y de area. Todos los graficos son interactivos y muestran detalles al pasar el cursor sobre los datos.</P>
        </ManualSection>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* SECCION 13: CUENTA Y SEGURIDAD */}
        {/* ═══════════════════════════════════════════════════════ */}
        <ManualSection number="13" icon={<LockResetIcon fontSize="small" />} title="Cuenta y Seguridad">
          <P>
            Desde el menu de usuario (icono de avatar en la esquina superior derecha) puede acceder a opciones de seguridad y gestion de su cuenta.
          </P>

          <Sub>Cambiar Contrasena</Sub>
          <Step num={1}>Haga clic en su avatar (inicial de su nombre) en la barra superior.</Step>
          <Step num={2}>Seleccione "Cambiar Contrasena" del menu desplegable.</Step>
          <Step num={3}>Ingrese su contrasena actual.</Step>
          <Step num={4}>Ingrese la nueva contrasena (minimo 6 caracteres).</Step>
          <Step num={5}>Confirme la nueva contrasena escribiendola nuevamente.</Step>
          <Step num={6}>Haga clic en "Cambiar Contrasena" para aplicar el cambio.</Step>

          <Warning>La nueva contrasena debe ser diferente a la actual y tener al menos 6 caracteres. Por seguridad, se le solicitara ingresar su sesion nuevamente si han pasado varios dias desde el ultimo inicio de sesion.</Warning>

          <Sub>Cerrar Sesion</Sub>
          <Step num={1}>Haga clic en su avatar en la barra superior.</Step>
          <Step num={2}>Seleccione "Cerrar Sesion" del menu desplegable.</Step>
          <Step num={3}>El sistema cerrara la sesion y lo redigira a la pantalla de login. Todos los datos no guardados se perderan.</Step>

          <Success>Al cerrar sesion, el sistema deshabilita automaticamente la conexion a la base de datos en la nube. Esto protege sus datos y evita que otro usuario acceda a su informacion sin autenticarse.</Success>

          <Sub>Indicador de Conexion</Sub>
          <P>En la barra superior puede ver el estado de conexion a internet:</P>
          <Step num={1}><strong>Icono de nube verde (CloudSync):</strong> Conexion activa. Todos los datos se sincronizan con la base de datos en tiempo real.</Step>
          <Step num={2}><strong>Chip "Offline" amarillo:</strong> Sin conexion a internet. Los datos se guardan localmente y se sincronizaran automaticamente cuando se restablezca la conexion.</Step>

          <Tip>Este sistema es una PWA (Aplicacion Web Progresiva). Puede instalarla en su celular o tablet como si fuera una app nativa. En Android, use el boton "Agregar a pantalla de inicio" del navegador Chrome. En iPhone, use el boton "Compartir" y seleccione "Agregar a pantalla de inicio". Una vez instalada, la app funciona incluso sin conexion a internet.</Tip>
        </ManualSection>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* SECCION: PREGUNTAS FRECUENTES */}
        {/* ═══════════════════════════════════════════════════════ */}
        <Divider sx={{ my: 4 }} />
        <ManualSection number="FAQ" icon={<HelpOutlineIcon fontSize="small" />} title="Preguntas Frecuentes">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <P bold>¿Que hago si se corta la luz o el internet mientras estoy haciendo un cierre?</P>
              <P>No se preocupe. El sistema guarda los datos localmente cada 2 segundos. Cuando se restablezca la conexion, los datos se sincronizaran automaticamente con la nube. Verifique que no cierre el navegador hasta que se restaure la conexion.</P>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <P bold>¿Puedo tener dos turnos abiertos al mismo tiempo?</P>
              <P>No. El sistema solo permite un turno activo. Si intenta crear un turno nuevo mientras hay uno en progreso, debera cerrar el turno actual primero.</P>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <P bold>¿Las lecturas iniciales se pasan automaticamente del turno anterior?</P>
              <P>Si. Cuando crea un nuevo turno, el sistema busca el ultimo turno cerrado del operador correspondiente y hereda sus lecturas finales como lecturas iniciales del nuevo turno. Siempre verifique que coincidan con el display del surtidor.</P>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <P bold>¿Que significa "Propina" en la Biblia?</P>
              <P>La propina es la diferencia entre los ingresos totales del operador y el valor de referencia de los litros vendidos. Si los ingresos superan el valor de referencia, hay propina (ganancia). Si los ingresos son menores, hay sobregiro (faltante).</P>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <P bold>¿Como se actualizan las tasas de cambio?</P>
              <P>Las tasas se actualizan automaticamente todos los dias a las 11:45 PM (hora de Venezuela) consultando la tasa oficial del Banco Central de Venezuela (BCV). La Tasa 2 del dia anterior se promociona automaticamente a Tasa 1.</P>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <P bold>¿Puedo usar la app sin conexion a internet?</P>
              <P>Si. La aplicacion es una PWA y funciona sin conexion. Los datos se guardan localmente y se sincronizan cuando recupera internet. Sin embargo, necesitas conexion para iniciar sesion por primera vez y para crear un nuevo turno.</P>
            </Paper>
          </Box>
        </ManualSection>

      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════
// GENERADOR PDF DEL MANUAL
// ═══════════════════════════════════════════════════════════════════
function generateManualPDF(stationName) {
  const doc = new jsPDF('p', 'mm', 'letter');
  const pw = 215.9;
  const ph = 279.4;
  const ml = 20;
  const mr = 20;
  const contentW = pw - ml - mr;
  let y = 20;

  const RED = [206, 17, 38];
  const BLUE = [0, 51, 153];
  const GRAY = [100, 100, 100];
  const DARK = [30, 30, 30];

  const checkPage = (needed) => {
    if (y + needed > ph - 25) {
      doc.addPage('letter', 'p');
      y = 25;
    }
  };

  const addTitle = (text) => {
    checkPage(20);
    doc.setFontSize(14);
    doc.setTextColor(...RED);
    doc.text(text, ml, y);
    y += 2;
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.5);
    doc.line(ml, y, pw - mr, y);
    y += 8;
  };

  const addSubtitle = (text) => {
    checkPage(12);
    doc.setFontSize(10);
    doc.setTextColor(...BLUE);
    doc.text(text, ml, y);
    y += 6;
  };

  const addText = (text) => {
    checkPage(8);
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(text, contentW);
    lines.forEach((line) => {
      checkPage(5);
      doc.text(line, ml, y);
      y += 4.5;
    });
    y += 2;
  };

  const addStep = (num, text) => {
    checkPage(10);
    doc.setFontSize(9);
    doc.setTextColor(...RED);
    doc.text(`${num}.`, ml, y);
    doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(text, contentW - 10);
    lines.forEach((line, i) => {
      checkPage(5);
      doc.text(line, ml + 10, y - (i * 0));
      y += 4.5;
    });
    y += 1;
  };

  const addTip = (text) => {
    checkPage(14);
    doc.setFillColor(232, 245, 233);
    doc.roundedRect(ml, y - 3, contentW, 12, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(46, 125, 50);
    const lines = doc.splitTextToSize(text, contentW - 8);
    lines.forEach((line) => {
      doc.text(line, ml + 4, y);
      y += 4;
    });
    y += 3;
  };

  // ── PORTADA ──
  doc.setFontSize(24);
  doc.setTextColor(...RED);
  doc.text(stationName, pw / 2, 80, { align: 'center' });

  doc.setFontSize(18);
  doc.setTextColor(...BLUE);
  doc.text('Manual de Usuario', pw / 2, 100, { align: 'center' });
  doc.text('Supervisor', pw / 2, 112, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text('Sistema de Cierre de Turno v1.0', pw / 2, 135, { align: 'center' });
  doc.text(`Generado: ${new Date().toLocaleDateString('es-VE')}`, pw / 2, 145, { align: 'center' });

  // ── SECCIONES ──
  doc.addPage('letter', 'p');
  y = 25;

  addTitle('1. Dashboard (Pantalla Principal)');
  addText('El Dashboard es la primera pantalla al iniciar sesion. Muestra un resumen del sistema, permite crear turnos y acceder rapidamente a las funciones principales.');
  addSubtitle('Crear un Turno');
  addStep(1, 'Seleccione el turno supervisor (1TS o 2TS) desde las tarjetas en el Dashboard.');
  addStep(2, 'El sistema crea el turno automaticamente con lecturas iniciales heredadas del turno anterior cerrado.');
  addStep(3, 'Un indicador "Turno Activo" aparece en la barra superior cuando el turno esta activo.');
  addTip('No puede tener dos turnos activos simultaneamente. Cierre el turno actual antes de crear uno nuevo.');

  addTitle('2. Recepcion de Gandola');
  addText('Registra la descarga de combustible desde una gandola a los tanques de almacenamiento de la estacion.');
  addSubtitle('Proceso');
  addStep(1, 'Haga clic en "Nueva Recepcion" para iniciar.');
  addStep(2, 'Seleccione el supervisor y complete los datos del conductor (nombre y CI).');
  addStep(3, 'Registre hora de llegada, hora de salida y litros por compartimento.');
  addStep(4, 'Tome lecturas en CM de cada tanque ANTES y DESPUES de la descarga.');
  addStep(5, 'El sistema convierte automaticamente los CM a litros y calcula la diferencia.');
  addTip('Las lecturas deben ser valores exactos de la tabla de calibracion (incrementos de 0.5 cm).');

  addTitle('3. Gastos del Turno');
  addText('Registra gastos en Bolivares (Bs.) durante el turno. Se convierten automaticamente a USD para la Biblia.');
  addStep(1, 'Ingrese el monto en Bs. y una descripcion breve del gasto.');
  addStep(2, 'El gasto se guarda automaticamente. Para eliminar, haga clic en el boton de papelera.');

  addTitle('4. Lecturas');
  addText('Registra las lecturas de bombas (surtidores), tanques y tasas de cambio del dia.');
  addSubtitle('Lecturas de Bombas');
  addStep(1, 'Lectura Inicial: Se hereda automaticamente del turno anterior. Verifique con el display del surtidor.');
  addStep(2, 'Lectura Final: Lea directamente del display del surtidor al cierre del turno.');
  addStep(3, 'Litros Vendidos = Lectura Final - Lectura Inicial (calculado automaticamente).');
  addSubtitle('Lecturas de Tanques');
  addStep(1, 'Toma la medida en CM con el metro mecanico en cada tanque.');
  addStep(2, 'Ingrese el valor en CM. El sistema lo convierte a litros con la tabla de calibracion.');
  addSubtitle('Tasas de Cambio');
  addStep(1, 'Tasa 1: Tasa principal del dia. Se usa para todos los calculos.');
  addStep(2, 'Tasa 2: Solo para turno nocturno (2TO). Para pagos con PV con tasa diferente.');
  addTip('Las tasas se actualizan automaticamente a las 11:45 PM (hora de Venezuela) desde el BCV.');

  checkPage(40);
  addTitle('5. Cierre de Turno');
  addText('Seccion mas critica del sistema. Registra cortes, PV, vales, transferencias y productos vendidos por cada isla.');
  addSubtitle('Cortes en Efectivo');
  addStep(1, 'Cortes en Bs.: Ingrese cada corte recibido en bolivares. Maximo configurable (por defecto 12).');
  addStep(2, 'Cortes en USD: Ingrese cada corte recibido en dolares.');
  addStep(3, 'UE (Unidades Extra): Montos adicionales que no son cortes regulares.');
  addSubtitle('Punto de Venta (PV)');
  addStep(1, 'Ingrese hasta 3 montos en Bs. por PV. Se convierten a USD automaticamente.');
  addStep(2, 'Para nocturno, hay un PV2 con la Tasa 2.');
  addSubtitle('Vales y Transferencias');
  addStep(1, 'Vales: Agregue monto (USD) y descripcion de cada vale.');
  addStep(2, 'Transferencias: Agregue monto (USD) y descripcion de cada transferencia.');
  addSubtitle('Productos Vendidos');
  addStep(1, 'Seleccione producto, cantidad y metodo de pago (PV, Bs., USD).');
  addTip('Los cambios se guardan automaticamente cada 2 segundos. Espere el indicador verde "Guardado".');

  checkPage(40);
  addTitle('6. Reporte de Lectura y Recepcion');
  addText('Vista consolidada en 3 columnas: lecturas diurnas (izquierda), inventario de tanques (centro) y lecturas nocturnas (derecha). Muestra lecturas de bombas, inventario de tanques en 4 momentos (inicial, antes/despues de descarga, final) y recepcion de gandola.');

  addTitle('7. Biblia (Resumen Financiero)');
  addText('Resumen financiero completo del turno. Calcula ingresos totales, propina del operador y balance general.');
  addSubtitle('Formula de Propina');
  addText('Propina = Ingresos Totales - (Litros Vendidos / Precio por Litro). Si es negativa, indica un sobregiro (faltante de caja). Los gastos del turno se restan del calculo en el Resumen.');

  addTitle('8. Cuadre PV (Punto de Venta)');
  addText('Conciliacion de pagos con tarjeta por isla. Muestra montos en Bs., USD y litros equivalentes para cada PV.');

  addTitle('9. Inventario');
  addText('Gestion de stock en dos niveles: almacen general e inventario por isla.');
  addSubtitle('Operaciones');
  addStep(1, 'Agregar Stock: Ingresa productos al almacen general.');
  addStep(2, 'Distribuir: Envia productos del almacen a una isla especifica.');
  addStep(3, 'Retornar: Devuelve productos de una isla al almacen general.');
  addStep(4, 'Editar: Modifica la cantidad de stock directamente en la tabla.');
  addTip('El sistema verifica que haya stock suficiente antes de distribuir o retornar productos.');

  checkPage(40);
  addTitle('10. Historial de Cierres');
  addText('Consulta de turnos cerrados. Filtre por fecha, revise el detalle completo (lecturas, Biblia, Cuadre PV) y genere PDFs de turnos anteriores.');

  addTitle('11. Generar PDF');
  addText('Genera y descarga reportes en PDF: Cierre de Turno (vertical), Reporte Lectura (horizontal), Biblia (vertical), Cuadre PV (vertical) o Todos en un solo PDF combinado.');

  addTitle('12. Estadisticas');
  addText('Graficos y metricas: litros vendidos por isla, tendencias diarias, ingresos, propinas y recepciones de gandola. Filtre por periodo (hoy, semana, mes, todos).');

  checkPage(30);
  addTitle('13. Cuenta y Seguridad');
  addSubtitle('Cambiar Contrasena');
  addStep(1, 'Clic en su avatar (esquina superior derecha) > "Cambiar Contrasena".');
  addStep(2, 'Ingrese contrasena actual, nueva contrasena (min. 6 caracteres) y confirme.');
  addSubtitle('Cerrar Sesion');
  addStep(1, 'Clic en su avatar > "Cerrar Sesion". Se deshabilita la conexion a la base de datos automaticamente.');
  addSubtitle('Indicador de Conexion');
  addStep(1, 'Nube verde: Conexion activa y sincronizada.');
  addStep(2, 'Chip "Offline" amarillo: Sin conexion. Los datos se guardan localmente.');
  addTip('La app es una PWA. Puede instalarla en su celular desde el navegador (Chrome: "Agregar a pantalla de inicio"). Funciona sin conexion a internet.');

  // ── PIES DE PAGINA ──
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(`${stationName} - Manual de Usuario Supervisor`, ml, ph - 12);
    doc.text(`Pagina ${i} de ${totalPages}`, pw - mr, ph - 12, { align: 'right' });
  }

  doc.save(`Manual_Supervisor_${stationName.replace(/\s+/g, '_')}.pdf`);
}