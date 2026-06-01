import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  render,
  Section,
  Text,
} from "@react-email/components"

export type CaratulaEmailProps = {
  lote: string
  numero: string
  contratista: string
  partida: string
  montoFormatted: string
  montoLetra: string
}

/** Asunto del correo (SPEC §8). */
export function caratulaSubject(p: {
  lote: string
  numero: string
  contratista: string
}): string {
  return `[NAUKA ${p.lote}] Solicitud de pago Est. ${p.numero} — ${p.contratista}`
}

const main = { backgroundColor: "#f6f6f6", fontFamily: "Arial, sans-serif" }
const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "24px",
  maxWidth: "560px",
}
const heading = { fontSize: "18px", fontWeight: 600, color: "#111111" }
const text = { fontSize: "14px", lineHeight: "22px", color: "#333333" }
const muted = { fontSize: "12px", lineHeight: "18px", color: "#777777" }

/** Template del correo de carátula. El PDF va como adjunto. */
export function CaratulaEmail({
  lote,
  numero,
  contratista,
  partida,
  montoFormatted,
  montoLetra,
}: CaratulaEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{`Solicitud de pago Est. ${numero} — ${contratista}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Solicitud de pago — NAUKA {lote}</Heading>
          <Text style={text}>
            Adjunto la carátula de la estimación <strong>{numero}</strong> del
            contratista <strong>{contratista}</strong>, partida{" "}
            <strong>{partida}</strong>, por un monto de{" "}
            <strong>{montoFormatted}</strong>.
          </Text>
          <Text style={text}>{montoLetra}</Text>
          <Section>
            <Text style={muted}>
              Este correo fue generado automáticamente por NAUKA Pagos (IZ
              Arquitectos). La carátula en PDF se incluye como archivo adjunto.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

/** Renderiza el template a HTML para pasarlo a Resend (`html`). */
export function renderCaratulaEmailHtml(
  props: CaratulaEmailProps,
): Promise<string> {
  return render(<CaratulaEmail {...props} />)
}
