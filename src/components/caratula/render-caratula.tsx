import { renderToBuffer } from "@react-pdf/renderer"
import { Caratula, type CaratulaProps } from "./caratula-document"

/**
 * Renderiza la carátula a un Buffer PDF (server-side).
 * Aísla el JSX de @react-pdf para que las server actions queden sin JSX.
 */
export function renderCaratulaPdf(props: CaratulaProps): Promise<Buffer> {
  return renderToBuffer(<Caratula {...props} />)
}
