import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  render,
  Section,
  Text,
} from "@react-email/components"

// Sub-fase 8d — 3 plantillas de correo del flujo de aprobación (React Email,
// mismo patrón que caratula-email.tsx). El deep-link `link` lleva a la solicitud
// específica en la bandeja. Resend en modo prueba solo entrega al dueño de la
// cuenta hasta verificar el dominio; el código queda listo.

const main = { backgroundColor: "#f6f6f6", fontFamily: "Arial, sans-serif" }
const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "24px",
  maxWidth: "560px",
}
const heading = { fontSize: "18px", fontWeight: 600, color: "#163d4a" }
const text = { fontSize: "14px", lineHeight: "22px", color: "#333333" }
const muted = { fontSize: "12px", lineHeight: "18px", color: "#777777" }
const button = {
  backgroundColor: "#163d4a",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  padding: "10px 18px",
  textDecoration: "none",
}
const footer = (
  <Section>
    <Text style={muted}>
      Correo generado automáticamente por NAUKA Pagos (IZ Arquitectos).
    </Text>
  </Section>
)

// ── (A) Nueva carátula por aprobar → aprobadores ─────────────────────────────

export type NuevaAprobacionProps = {
  lote: string
  numero: string
  contratista: string
  partida: string
  montoFormatted: string
  firmanteNombre: string
  link: string
}

export function nuevaAprobacionSubject(p: {
  lote: string
  numero: string
  contratista: string
}): string {
  return `[NAUKA ${p.lote}] Carátula por aprobar — Est. ${p.numero} ${p.contratista}`
}

function NuevaAprobacionEmail({
  numero,
  contratista,
  partida,
  montoFormatted,
  firmanteNombre,
  link,
}: NuevaAprobacionProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{`Carátula por aprobar — Est. ${numero} ${contratista}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Tienes una carátula por aprobar</Heading>
          <Text style={text}>
            Hola {firmanteNombre}, se te solicita revisar y firmar la carátula
            de la estimación <strong>{numero}</strong> —{" "}
            <strong>{contratista}</strong>, partida <strong>{partida}</strong>,
            por <strong>{montoFormatted}</strong>.
          </Text>
          <Section style={{ margin: "16px 0" }}>
            <Button href={link} style={button}>
              Revisar y firmar
            </Button>
          </Section>
          {footer}
        </Container>
      </Body>
    </Html>
  )
}

export function renderNuevaAprobacionHtml(
  p: NuevaAprobacionProps,
): Promise<string> {
  return render(<NuevaAprobacionEmail {...p} />)
}

// ── (C) Rechazo → admin ──────────────────────────────────────────────────────

export type RechazadaProps = {
  lote: string
  numero: string
  contratista: string
  firmanteNombre: string
  motivo: string
  link: string
}

export function rechazadaSubject(p: {
  lote: string
  numero: string
  contratista: string
}): string {
  return `[NAUKA ${p.lote}] Carátula RECHAZADA — Est. ${p.numero} ${p.contratista}`
}

function RechazadaEmail({
  numero,
  contratista,
  firmanteNombre,
  motivo,
  link,
}: RechazadaProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{`Carátula rechazada — Est. ${numero} ${contratista}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Carátula rechazada</Heading>
          <Text style={text}>
            <strong>{firmanteNombre}</strong> rechazó la carátula de la
            estimación <strong>{numero}</strong> —{" "}
            <strong>{contratista}</strong>.
          </Text>
          <Text style={text}>
            Motivo: <strong>{motivo}</strong>
          </Text>
          <Section style={{ margin: "16px 0" }}>
            <Button href={link} style={button}>
              Ver en la bandeja
            </Button>
          </Section>
          {footer}
        </Container>
      </Body>
    </Html>
  )
}

export function renderRechazadaHtml(p: RechazadaProps): Promise<string> {
  return render(<RechazadaEmail {...p} />)
}

// ── (D) Aprobación completa → admin (PDF adjunto) ─────────────────────────────

export type CompletaProps = {
  lote: string
  numero: string
  contratista: string
  link: string
}

export function completaSubject(p: {
  lote: string
  numero: string
  contratista: string
}): string {
  return `[NAUKA ${p.lote}] Carátula APROBADA — Est. ${p.numero} ${p.contratista}`
}

function CompletaEmail({ numero, contratista, link }: CompletaProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{`Carátula aprobada — Est. ${numero} ${contratista}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Carátula aprobada</Heading>
          <Text style={text}>
            La carátula de la estimación <strong>{numero}</strong> —{" "}
            <strong>{contratista}</strong> fue aprobada por todos los firmantes.
            Ya puedes enviarla al pagador. El PDF va adjunto.
          </Text>
          <Section style={{ margin: "16px 0" }}>
            <Button href={link} style={button}>
              Ver en la bandeja
            </Button>
          </Section>
          {footer}
        </Container>
      </Body>
    </Html>
  )
}

export function renderCompletaHtml(p: CompletaProps): Promise<string> {
  return render(<CompletaEmail {...p} />)
}
