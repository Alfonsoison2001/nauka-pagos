// Fórmulas calculadas del formato verde Buy-Out (cols M, O, Q, R, S, T del Excel
// — ver docs/future-modules/buyout-L3-estructura.md §2). Solo se guardan los
// INPUTS; estos derivados se recalculan, no se duplican en la base.
//
//   M IMPORTE SIN IVA    = J cantidad × L unitario
//   O TOTAL SOBRECOSTO   = M × N sobrecosto%
//   Q $ IVA              = (M + O) × P iva%
//   R IMPORTE TOTAL      = M + O + Q
//   S T.C                = tipo de cambio de la moneda (buyout_fx)
//   T TOTAL MXN          = R × S

export type LineaInputs = {
  cantidad: number
  unitario: number
  /** Fracción (0.05 = 5%). */
  sobrecostoPct: number
  /** Fracción (0.16 = 16%). */
  ivaPct: number
  /** Tipo de cambio de la moneda de la línea (MXN = 1). */
  tc: number
}

export type LineaCalc = {
  importeSinIva: number
  totalSobrecosto: number
  iva: number
  importeTotal: number
  totalMxn: number
}

export function calcLinea({
  cantidad,
  unitario,
  sobrecostoPct,
  ivaPct,
  tc,
}: LineaInputs): LineaCalc {
  const importeSinIva = cantidad * unitario
  const totalSobrecosto = importeSinIva * sobrecostoPct
  const iva = (importeSinIva + totalSobrecosto) * ivaPct
  const importeTotal = importeSinIva + totalSobrecosto + iva
  const totalMxn = importeTotal * tc
  return { importeSinIva, totalSobrecosto, iva, importeTotal, totalMxn }
}
