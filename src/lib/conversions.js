// cm-to-liters conversion - exact lookup matching Excel VLOOKUP FALSE
import { CM_TO_LITERS_TABLE } from '../config/constants.js';

/**
 * Convert CM to Liters using exact lookup from the calibration table.
 * Matches Excel: =IFERROR(VLOOKUP(I6, Configuracion!$B$3:$C$462, 2, FALSE()), "")
 * No rounding, no interpolation. Only exact values from the table.
 * Table has 0.5 cm increments: 0.5, 1.0, 1.5, 2.0 ... 230.0
 * If the CM value is not exactly in the table, returns 0.
 */
export function cmToLiters(cm) {
  // Force to number (handles string inputs from text fields)
  const num = parseFloat(cm);
  if (!num || num <= 0) return 0;

  // Exact lookup only - no rounding, no approximation
  const entry = CM_TO_LITERS_TABLE.find(([cmVal]) => cmVal === num);
  if (entry) return entry[1];

  // Value not found in table (like VLOOKUP FALSE returning #N/A)
  return 0;
}

/**
 * Convert liters to USD using rate (price per liter = tasa/2)
 */
export function litersToUSD(liters, tasa) {
  if (tasa === 0) return 0;
  return (liters * tasa) / 2;
}

/**
 * Convert USD to Bs using tasa
 */
export function usdToBs(usd, tasa) {
  return usd * tasa;
}

/**
 * Convert Bs to USD using tasa
 */
export function bsToUsd(bs, tasa) {
  if (tasa === 0) return 0;
  return bs / tasa;
}
