import { roundDown2, roundDownTo10 } from './formatters.js';

/**
 * Calculate liters sold for a pump reading
 */
export function calcLitersSold(reading) {
  return reading.finalReading - reading.initialReading;
}

/**
 * Calculate total Bs from cortes + adicionales for an island
 */
export function calcBsTotal(island) {
  const cortesBsSum = island.cortesBs.reduce((sum, val) => sum + val, 0);
  return cortesBsSum + island.bsAdicionales;
}

/**
 * Calculate total USD from cortes + adicionales for an island
 */
export function calcUSDTotal(island) {
  const cortesUSDSum = island.cortesUSD.reduce((sum, val) => sum + val, 0);
  return cortesUSDSum + island.usdAdicionales;
}

/**
 * Calculate PV total USD from 3 montos
 */
export function calcPVTotalUSD(monto1, monto2, monto3) {
  return monto1 + monto2 + monto3;
}

/**
 * Convert PV Bs to USD using tasa
 */
export function pvBsToUSD(pvTotalBs, tasa) {
  if (tasa === 0) return 0;
  return pvTotalBs / tasa;
}

/**
 * Convert PV USD to Bs using tasa
 */
export function pvUSDToBs(pvTotalUSD, tasa) {
  return pvTotalUSD * tasa;
}

/**
 * Convert USD to equivalent liters (price per liter = tasa/2)
 */
export function usdToLiters(usd, tasa) {
  if (tasa === 0) return 0;
  return (usd * 2) / tasa;
}

/**
 * Calculate total liters sold across all islands
 */
export function calcTotalLitersSold(readings) {
  return readings.reduce((sum, r) => sum + r.litersSold, 0);
}

/**
 * Calculate liters sold per island
 */
export function calcLitersByIsland(readings) {
  const result = { 1: 0, 2: 0, 3: 0 };
  for (const r of readings) {
    result[r.islandId] += r.litersSold;
  }
  return result;
}

/**
 * Litros equivalentes (referencia) = litros vendidos / 2
 */
export function calcLitersRef(litersSold) {
  return litersSold / 2;
}

/**
 * Calculate Biblia (financial summary) for all islands
 */
export function calculateBiblia(shift) {
  const litersByIsland = calcLitersByIsland(shift.pumpReadings);

  return shift.islands.map((island) => {
    const bsTotal = calcBsTotal(island);
    const bsInUSD = shift.tasa1 > 0 ? bsTotal / shift.tasa1 : 0;
    const usdTotal = calcUSDTotal(island);
    const puntoTotal = island.pvTotalUSD + island.pv2TotalUSD;
    const ueTotal = island.ueUSD;
    const valesMonto = island.valesMonto;
    const transferenciaMonto = island.transferenciaMonto;

    const ingresosTotalUSD = bsInUSD + usdTotal + puntoTotal + ueTotal + valesMonto + transferenciaMonto;
    const litersRef = calcLitersRef(litersByIsland[island.islandId] || 0);
    const propinaCalculo = ingresosTotalUSD - litersRef;
    const propinaUSD = propinaCalculo > 0 ? roundDown2(propinaCalculo) : 0;
    const propinaBs = propinaCalculo > 0 ? roundDownTo10(propinaCalculo * shift.tasa1) : 0;

    return {
      islandId: island.islandId,
      operatorName: island.operatorName,
      litersRef,
      bsTotal,
      bsInUSD,
      usdTotal,
      puntoTotal,
      ueTotal,
      valesDescripcion: island.valesDescripcion,
      valesMonto,
      transferenciaDescripcion: island.transferenciaDescripcion,
      transferenciaMonto,
      ingresosTotalUSD,
      propinaCalculo,
      propinaUSD,
      propinaBs,
    };
  });
}

/**
 * Calculate Biblia totals (sum of all islands)
 */
export function calculateBibliaTotals(biblia) {
  return {
    totalLitersRef: biblia.reduce((s, b) => s + b.litersRef, 0),
    totalBs: biblia.reduce((s, b) => s + b.bsTotal, 0),
    totalBsInUSD: biblia.reduce((s, b) => s + b.bsInUSD, 0),
    totalUSD: biblia.reduce((s, b) => s + b.usdTotal, 0),
    totalPunto: biblia.reduce((s, b) => s + b.puntoTotal, 0),
    totalUE: biblia.reduce((s, b) => s + b.ueTotal, 0),
    totalVales: biblia.reduce((s, b) => s + b.valesMonto, 0),
    totalTransferencia: biblia.reduce((s, b) => s + b.transferenciaMonto, 0),
    totalIngresosUSD: biblia.reduce((s, b) => s + b.ingresosTotalUSD, 0),
    totalPropinaUSD: biblia.reduce((s, b) => s + b.propinaUSD, 0),
    totalPropinaBs: biblia.reduce((s, b) => s + b.propinaBs, 0),
  };
}

/**
 * Calculate Cuadre PV (POS balance) for all islands
 */
export function calculateCuadrePV(shift) {
  return shift.islands.map((island) => {
    const pvTotalUSD = island.pvTotalUSD;
    const pvTotalBs = island.pvTotalBs;
    const pvUSDinLiters = usdToLiters(pvTotalUSD, shift.tasa1);

    const pv2TotalUSD = island.pv2TotalUSD;
    const pv2TotalBs = island.pv2TotalBs;
    const pv2USDinLiters = shift.tasa2 > 0 ? usdToLiters(pv2TotalUSD, shift.tasa2) : 0;

    return {
      islandId: island.islandId,
      pvTotalUSD,
      pvTotalBs,
      pvUSDinLiters,
      pv2TotalUSD,
      pv2TotalBs,
      pv2USDinLiters,
    };
  });
}

/**
 * Calculate Cuadre PV totals
 */
export function calculateCuadrePVTotals(rows, tasa1, tasa2) {
  const totalPVUSD = rows.reduce((s, r) => s + r.pvTotalUSD, 0);
  const totalPVBs = rows.reduce((s, r) => s + r.pvTotalBs, 0);
  const totalPVLiters = rows.reduce((s, r) => s + r.pvUSDinLiters, 0);
  const totalPV2USD = rows.reduce((s, r) => s + r.pv2TotalUSD, 0);
  const totalPV2Bs = rows.reduce((s, r) => s + r.pv2TotalBs, 0);
  const totalPV2Liters = rows.reduce((s, r) => s + r.pv2USDinLiters, 0);

  return {
    totalPVUSD,
    totalPVBs,
    totalPVLiters,
    totalPV2USD,
    totalPV2Bs,
    totalPV2Liters,
    grandTotalUSD: totalPVUSD + totalPV2USD,
    grandTotalBs: totalPVBs + totalPV2Bs,
    grandTotalLiters: totalPVLiters + totalPV2Liters,
  };
}

/**
 * Calculate inventory for all products
 */
export function calculateInventory(products, initialStock, islandsSold) {
  return products.map((product) => {
    let totalVendido = 0;
    const vendidoIsla1 = islandsSold[1]?.filter((p) => p.productName === product.name).reduce((s, p) => s + p.quantity, 0) || 0;
    const vendidoIsla2 = islandsSold[2]?.filter((p) => p.productName === product.name).reduce((s, p) => s + p.quantity, 0) || 0;
    const vendidoIsla3 = islandsSold[3]?.filter((p) => p.productName === product.name).reduce((s, p) => s + p.quantity, 0) || 0;
    totalVendido = vendidoIsla1 + vendidoIsla2 + vendidoIsla3;

    const stockInicial = initialStock[product.name] || 0;
    const stockFinal = stockInicial - totalVendido;

    return {
      productName: product.name,
      stockInicial,
      vendidoIsla1,
      vendidoIsla2,
      vendidoIsla3,
      totalVendido,
      stockFinal,
      priceUSD: product.priceUSD,
      totalUSD: totalVendido * product.priceUSD,
    };
  });
}
