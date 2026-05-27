import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const mxnFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
})

/** Format a number as $ 1,234,567.89 (es-MX, MXN). */
export function formatMXN(value: number): string {
  return mxnFormatter.format(value)
}
