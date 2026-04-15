import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Format a date to DD/MM/YYYY
 */
export function formatDate(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd/MM/yyyy');
}

/**
 * Format a date to full string in Spanish
 */
export function formatDateFull(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, "EEEE dd 'de' MMMM yyyy", { locale: es });
}

/**
 * Format time to AM/PM format
 */
export function formatTime(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'h:mm a');
}

/**
 * Format number as currency (Bolívares)
 */
export function formatBs(amount) {
  const n = amount == null || isNaN(amount) ? 0 : amount;
  return `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format number as currency (USD)
 */
export function formatUSD(amount) {
  const n = amount == null || isNaN(amount) ? 0 : amount;
  return `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format number with commas
 */
export function formatNumber(num, decimals = 2) {
  const n = num == null || isNaN(num) ? 0 : num;
  return n.toLocaleString('es-VE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Parse DD/MM/YYYY to Date
 */
export function parseDate(dateStr) {
  return parse(dateStr, 'dd/MM/yyyy', new Date());
}

/**
 * Format date to YYYY-MM-DD (for input[type=date])
 */
export function toInputDate(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'yyyy-MM-dd');
}

/**
 * Get current date in Venezuela timezone (America/Caracas)
 */
export function getVenezuelaDate() {
  const now = new Date();
  const venezuelaOffset = -4 * 60; // UTC-4
  const localOffset = now.getTimezoneOffset();
  const diff = localOffset - venezuelaOffset;
  return new Date(now.getTime() + diff * 60 * 1000);
}

/**
 * Get current date string in DD/MM/YYYY format (Venezuela time)
 */
export function getVenezuelaDateString() {
  return formatDate(getVenezuelaDate());
}

/**
 * Round down to nearest 10 (for propina Bs calculation)
 */
export function roundDownTo10(num) {
  return Math.floor(num / 10) * 10;
}

/**
 * ROUNDDOWN to 2 decimal places
 */
export function roundDown2(num) {
  return Math.floor(num * 100) / 100;
}

/**
 * Generate unique ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
