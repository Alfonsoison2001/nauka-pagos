import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"
import { numeroALetras } from "@/lib/format/numero-a-letras"
import { formatMXN } from "@/lib/utils"

// ── Props ─────────────────────────────────────────────────────────────────────

export type CaratulaFirmante = {
  nombre: string
  cargo: string
  empresa: string
}

export type CaratulaProps = {
  /** Data URI del logo del proyecto (opcional). */
  logoSrc?: string | null
  /**
   * Nombre del contratista, si la partida tiene uno asignado. El componente
   * NO asume la procedencia de la partida: hoy viene de partidas-con-
   * contratista, pero a futuro podría venir del catálogo del proyecto sin
   * contratista. Cuando es null/ausente, la carátula omite ese dato. La server
   * action es la única que sabe de dónde salió la partida.
   */
  contratistaNombre?: string | null
  partidaNombre: string
  /** Lote del proyecto (Excel "Ubicación"). */
  ubicacion: string
  /** Etiqueta de la estimación (Excel D4 = "Finiquito", "Est 1", …). */
  numero: string
  /** Fecha ya formateada dd/mm/yyyy. */
  fecha: string
  /** Montos ya resueltos con/sin IVA según caratula_iva_mode. */
  contratoTotal: number
  /** Saldo por ejercer ANTES de esta estimación (disponible). */
  saldoPorEjercerHeader: number
  importe: number
  /** Acumulado incluyendo esta estimación. */
  acumulado: number
  ppto: number
  /** ppto − acumulado (después de esta). */
  porEjercer: number
  firmantes: CaratulaFirmante[]
}

// ── Estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#111111",
  },
  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
  },
  logo: { width: 90, height: 36, objectFit: "contain" },
  infoBlock: { flexDirection: "row", justifyContent: "space-between" },
  infoLeft: { width: "62%" },
  infoRight: { width: "34%", alignItems: "flex-end" },
  infoLine: { flexDirection: "row", marginBottom: 3 },
  infoLabel: { width: 90, fontFamily: "Helvetica-Bold" },
  infoValue: { flex: 1 },
  infoQualifier: { fontSize: 6.3, color: "#666666" },
  estimacionBox: {
    borderWidth: 1,
    borderColor: "#111111",
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  estimacionLabel: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  estimacionValue: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 2 },
  // Tabla
  table: { marginTop: 18 },
  tHeadRow: {
    flexDirection: "row",
    backgroundColor: "#222222",
    color: "#ffffff",
  },
  tRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#dddddd",
  },
  tTotalRow: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    fontFamily: "Helvetica-Bold",
  },
  th: { paddingVertical: 5, paddingHorizontal: 4, fontSize: 7.5 },
  td: { paddingVertical: 5, paddingHorizontal: 4 },
  cEstim: { width: "14%" },
  cCateg: { width: "22%" },
  cContr: { width: "18%" },
  cNum: { width: "11.5%", textAlign: "right" },
  cPpto: { width: "11.5%", textAlign: "right" },
  letra: {
    marginTop: 8,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  nota: {
    marginTop: 10,
    fontSize: 7,
    color: "#777777",
    lineHeight: 1.35,
  },
  // Autorizaciones
  autoTitle: {
    marginTop: 48,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    letterSpacing: 1,
  },
  firmasRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 56,
  },
  firmaCol: { width: "30%", alignItems: "center" },
  firmaLine: {
    borderTopWidth: 1,
    borderColor: "#111111",
    width: "100%",
    marginBottom: 4,
  },
  firmaLabel: { fontSize: 7, color: "#777777", marginBottom: 4 },
  firmaNombre: { fontFamily: "Helvetica-Bold", fontSize: 8.5 },
  firmaCargo: { fontSize: 8, marginTop: 1 },
  firmaEmpresa: { fontSize: 8, color: "#555555", marginTop: 1 },
})

// ── Componente ────────────────────────────────────────────────────────────────

function HeaderInfoLine({
  label,
  value,
  qualifier,
}: {
  label: string
  value: string
  qualifier?: string
}) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>
        {value}
        {qualifier ? (
          <Text style={styles.infoQualifier}>
            {"  "}
            {qualifier}
          </Text>
        ) : null}
      </Text>
    </View>
  )
}

export function Caratula(props: CaratulaProps) {
  const {
    logoSrc,
    contratistaNombre,
    partidaNombre,
    ubicacion,
    numero,
    fecha,
    contratoTotal,
    saldoPorEjercerHeader,
    importe,
    acumulado,
    ppto,
    porEjercer,
    firmantes,
  } = props

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Encabezado */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>
            {contratistaNombre
              ? `${contratistaNombre} — ${partidaNombre}`
              : partidaNombre}
          </Text>
          {logoSrc ? <Image style={styles.logo} src={logoSrc} /> : null}
        </View>

        <View style={styles.infoBlock}>
          <View style={styles.infoLeft}>
            {contratistaNombre ? (
              <HeaderInfoLine label="Propietario:" value={contratistaNombre} />
            ) : null}
            <HeaderInfoLine label="Ubicación:" value={ubicacion} />
            <HeaderInfoLine label="Partida:" value={partidaNombre} />
            <HeaderInfoLine
              label="Contrato Total:"
              value={formatMXN(contratoTotal)}
            />
            <HeaderInfoLine
              label="Saldo por Ejercer:"
              value={formatMXN(saldoPorEjercerHeader)}
              qualifier="(antes de esta estimación)"
            />
            <HeaderInfoLine label="Fecha:" value={fecha} />
          </View>
          <View style={styles.infoRight}>
            <View style={styles.estimacionBox}>
              <Text style={styles.estimacionLabel}>ESTIMACION</Text>
              <Text style={styles.estimacionValue}>{numero}</Text>
            </View>
          </View>
        </View>

        {/* Tabla */}
        <View style={styles.table}>
          <View style={styles.tHeadRow}>
            <Text style={[styles.th, styles.cEstim]}>ESTIMACION</Text>
            <Text style={[styles.th, styles.cCateg]}>CATEGORIA</Text>
            <Text style={[styles.th, styles.cContr]}>NOMBRE CONTRATISTA</Text>
            <Text style={[styles.th, styles.cNum]}>IMPORTE</Text>
            <Text style={[styles.th, styles.cNum]}>
              ACUMULADO (incluye esta)
            </Text>
            <Text style={[styles.th, styles.cPpto]}>PPTO</Text>
            <Text style={[styles.th, styles.cPpto]}>POR EJERCER (después)</Text>
          </View>

          <View style={styles.tRow}>
            <Text style={[styles.td, styles.cEstim]}>{numero}</Text>
            <Text style={[styles.td, styles.cCateg]}>{partidaNombre}</Text>
            <Text style={[styles.td, styles.cContr]}>
              {contratistaNombre || " "}
            </Text>
            <Text style={[styles.td, styles.cNum]}>{formatMXN(importe)}</Text>
            <Text style={[styles.td, styles.cNum]}>{formatMXN(acumulado)}</Text>
            <Text style={[styles.td, styles.cPpto]}>{formatMXN(ppto)}</Text>
            <Text style={[styles.td, styles.cPpto]}>
              {formatMXN(porEjercer)}
            </Text>
          </View>

          <View style={styles.tTotalRow}>
            <Text style={[styles.td, styles.cEstim]}>TOTAL ESTIMACION</Text>
            <Text style={[styles.td, styles.cCateg]}>{partidaNombre}</Text>
            <Text style={[styles.td, styles.cContr]}> </Text>
            <Text style={[styles.td, styles.cNum]}>{formatMXN(importe)}</Text>
            <Text style={[styles.td, styles.cNum]}> </Text>
            <Text style={[styles.td, styles.cPpto]}> </Text>
            <Text style={[styles.td, styles.cPpto]}> </Text>
          </View>
        </View>

        <Text style={styles.letra}>{numeroALetras(importe)}</Text>

        <Text style={styles.nota}>
          Notas: 'Acumulado' suma todas las estimaciones de la misma partida con
          fecha ≤ esta, incluyéndola — refleja el avance contratado del
          contrato, asumiendo que esta estimación será aprobada y pagada. 'Saldo
          por Ejercer (antes)' refleja el saldo antes de esta estimación
          (Contrato Total − estimaciones anteriores). 'Por Ejercer (después)'
          refleja el saldo posterior.
        </Text>

        {/* Autorizaciones */}
        <Text style={styles.autoTitle}>AUTORIZACIONES</Text>
        <View style={styles.firmasRow}>
          {firmantes.map((f, i) => (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: orden fijo 1-3
              key={`${f.nombre}-${i}`}
              style={styles.firmaCol}
            >
              <View style={styles.firmaLine} />
              <Text style={styles.firmaLabel}>FIRMA</Text>
              <Text style={styles.firmaNombre}>{f.nombre}</Text>
              <Text style={styles.firmaCargo}>{f.cargo}</Text>
              <Text style={styles.firmaEmpresa}>{f.empresa}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}
