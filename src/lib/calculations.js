// src/lib/calculations.js
import { roundDown2, roundDownTo10 } from './formatters.js';

export function calcLitersSold(reading) {
  return reading.finalReading - reading.initialReading;
}

export function calcBsTotal(island) {
  const cortesBsSum = island.cortesBs.reduce((sum, val) => sum + val, 0);
  return cortesBsSum + island.bsAdicionales;
}

export function calcUSDTotal(island) {
  const cortesUSDSum = island.cortesUSD.reduce((sum, val) => sum + val, 0);
  return cortesUSDSum + island.usdAdicionales;
}

export function calcPVTotalUSD(monto1, monto2, monto3) {
  return monto1 + monto2 + monto3;
}

export function pvBsToUSD(pvTotalBs, tasa) {
  if (tasa === 0) return 0;
  return pvTotalBs / tasa;
}

export function pvUSDToBs(pvTotalUSD, tasa) {
  return pvTotalUSD * tasa;
}

export function usdToLiters(usd, tasa) {
  if (tasa === 0) return 0;
  return (usd * 2) / tasa;
}

export function calcTotalLitersSold(readings) {
  return readings.reduce((sum, r) => sum + r.litersSold, 0);
}

export function calcLitersByIsland(readings) {
  const result = {};
  for (const r of readings) {
    const id = r.islandId;
    result[id] = (result[id] || 0) + r.litersSold;
  }
  return result;
}

export function calcLitersRef(litersSold) {
  return litersSold / 2;
}

export function calculateBiblia(shift) {
  const litersByIsland = calcLitersByIsland(shift.pumpReadings);

  return shift.islands.map((island) => {
    const bsTotal = calcBsTotal(island);
    const bsInUSD = shift.tasa1 > 0 ? bsTotal / shift.tasa1 : 0;
    const usdTotal = calcUSDTotal(island);
    const pv1Total = island.pvTotalUSD || 0;
    const pv1TotalBs = island.pvTotalBs || 0;
    const pv2Total = island.pv2TotalUSD || 0;
    const pv2TotalBs = island.pv2TotalBs || 0;
    const puntoTotal = pv1Total + pv2Total;
    const valesMonto = Array.isArray(island.vales)
      ? island.vales.reduce((s, v) => s + (v.monto || 0), 0)
      : (island.valesMonto || 0);
    const transferenciaMonto = Array.isArray(island.transferencias)
      ? island.transferencias.reduce((s, t) => s + (t.monto || 0), 0)
      : (island.transferenciaMonto || 0);

    const ingresosTotalUSD = bsInUSD + usdTotal + puntoTotal + valesMonto + transferenciaMonto;
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
      pv1Total,
      pv1TotalBs,
      pv2Total,
      pv2TotalBs,
      puntoTotal,
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

export function calculateBibliaTotals(biblia) {
  return {
    totalLitersRef: biblia.reduce((s, b) => s + b.litersRef, 0),
    totalBs: biblia.reduce((s, b) => s + b.bsTotal, 0),
    totalBsInUSD: biblia.reduce((s, b) => s + b.bsInUSD, 0),
    totalUSD: biblia.reduce((s, b) => s + b.usdTotal, 0),
    totalPv1: biblia.reduce((s, b) => s + b.pv1Total, 0),
    totalPv1Bs: biblia.reduce((s, b) => s + b.pv1TotalBs, 0),
    totalPv2: biblia.reduce((s, b) => s + b.pv2Total, 0),
    totalPv2Bs: biblia.reduce((s, b) => s + b.pv2TotalBs, 0),
    totalPunto: biblia.reduce((s, b) => s + b.puntoTotal, 0),
    totalVales: biblia.reduce((s, b) => s + b.valesMonto, 0),
    totalTransferencia: biblia.reduce((s, b) => s + b.transferenciaMonto, 0),
    totalIngresosUSD: biblia.reduce((s, b) => s + b.ingresosTotalUSD, 0),
    totalPropinaUSD: biblia.reduce((s, b) => s + b.propinaUSD, 0),
    totalPropinaBs: biblia.reduce((s, b) => s + b.propinaBs, 0),
  };
}

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
 * Calcula inventario de productos por isla — DINÁMICO.
 * Itera sobre las keys de islandsSold en vez de hardcodear {1,2,3}.
 *
 * @param {Array} products - Lista de productos {name, priceUSD}
 * @param {Object} initialStock - Stock inicial {productName: cantidad}
 * @param {Object} islandsSold - Productos vendidos por isla {islandId: [{productName, quantity}]}
 * @returns {Array} Inventario con vendidoPorIsla: {islandId: cantidad}
 */
export function calculateInventory(products, initialStock, islandsSold) {
  // Obtener IDs de islas presentes en los datos de venta
  const islandIds = Object.keys(islandsSold).map(Number).sort((a, b) => a - b);

  return products.map((product) => {
    let totalVendido = 0;
    const vendidoPorIsla = {};

    for (const id of islandIds) {
      const vendido = islandsSold[id]?.filter((p) => p.productName === product.name).reduce((s, p) => s + p.quantity, 0) || 0;
      vendidoPorIsla[id] = vendido;
      totalVendido += vendido;
    }

    const stockInicial = initialStock[product.name] || 0;
    const stockFinal = stockInicial - totalVendido;

    return {
      productName: product.name,
      stockInicial,
      vendidoPorIsla,
      totalVendido,
      stockFinal,
      priceUSD: product.priceUSD,
      totalUSD: totalVendido * product.priceUSD,
    };
  });
}