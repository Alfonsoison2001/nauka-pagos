// Conversión de número a letras para cantidades en pesos mexicanos.
// Formato: "(SON: CIENTO NOVENTA Y UN MIL CIENTO SESENTA Y OCHO PESOS 00/100 M.N.)"
//
// Apócope: "uno" → "un", "veintiuno" → "veintiún", porque en una cantidad
// siempre precede a un sustantivo masculino (mil / millón / pesos).

const UNIDADES = [
  "",
  "un",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
  "veinte",
  "veintiún",
  "veintidós",
  "veintitrés",
  "veinticuatro",
  "veinticinco",
  "veintiséis",
  "veintisiete",
  "veintiocho",
  "veintinueve",
]

const DECENAS = [
  "",
  "",
  "",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa",
]

const CENTENAS = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
]

/** 0..99 → palabras (vacío para 0). */
function tens(n: number): string {
  if (n < 30) return UNIDADES[n]
  const t = Math.floor(n / 10)
  const u = n % 10
  return DECENAS[t] + (u > 0 ? ` y ${UNIDADES[u]}` : "")
}

/** 0..999 → palabras (vacío para 0). */
function hundreds(n: number): string {
  if (n === 0) return ""
  if (n === 100) return "cien"
  const c = Math.floor(n / 100)
  const r = n % 100
  const parts: string[] = []
  if (c > 0) parts.push(CENTENAS[c])
  if (r > 0) parts.push(tens(r))
  return parts.join(" ")
}

/** Entero ≥ 0 → palabras. */
function enteroALetras(num: number): string {
  if (num === 0) return "cero"

  const millones = Math.floor(num / 1_000_000)
  const resto = num % 1_000_000
  const miles = Math.floor(resto / 1000)
  const unidades = resto % 1000

  const parts: string[] = []

  if (millones > 0) {
    parts.push(millones === 1 ? "un millón" : `${hundreds(millones)} millones`)
  }
  if (miles > 0) {
    parts.push(miles === 1 ? "mil" : `${hundreds(miles)} mil`)
  }
  if (unidades > 0) {
    parts.push(hundreds(unidades))
  }

  return parts.join(" ")
}

/**
 * Cantidad en pesos a letra, formato MX estándar:
 *   "(SON: CIENTO NOVENTA Y UN MIL ... PESOS 00/100 M.N.)"
 */
export function numeroALetras(value: number): string {
  const safe = Number.isFinite(value) ? Math.abs(value) : 0
  const cents = Math.round(safe * 100)
  const entero = Math.floor(cents / 100)
  const centavos = cents % 100

  const palabras = enteroALetras(entero).toUpperCase()
  const peso = entero === 1 ? "PESO" : "PESOS"
  // "millón/millones" toma "de" cuando precede directo al sustantivo
  // (un millón DE pesos), pero no cuando le siguen cantidades menores
  // (un millón ciento sesenta pesos). "mil" nunca toma "de".
  const pesoPhrase = /MILL(?:ÓN|ONES)$/.test(palabras) ? `DE ${peso}` : peso
  const centStr = String(centavos).padStart(2, "0")

  return `(SON: ${palabras} ${pesoPhrase} ${centStr}/100 M.N.)`
}
