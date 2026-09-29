/** Donut geometry in SVG user units; the viewBox is 256 wide. */
export const DONUT = (() => {
  const center = 128
  const radius = 84
  const stroke = 24
  const notchWidth = 3
  const notchHalfLength = 15
  return {
    center,
    radius,
    stroke,
    circumference: 2 * Math.PI * radius,
    capRadius: stroke / 2,
    notchWidth,
    notchHalfLength,
    // One unit of panel colour each side keeps the dark notch at 3:1 against the teal fill.
    casingWidth: notchWidth + 2,
    // Track left showing between an unmet fill's round tip and the casing, so it never reads as a hairline.
    notchGap: 3,
    tickLabelRadius: radius + notchHalfLength + 20,
    discRadius: center - 2,
  }
})()

/** How the donut's fill arc ends. `flush` is a square end on the notch. */
export type DonutFillEnd = "round" | "flush" | "full"

/** The drawn donut fill, as positions along the ring in `pathLength={100}` units. */
export interface DonutFill {
  /** Where the butt-ended arc body starts and ends; round ends are separate cap dots centred here. */
  arcStart: number
  arcEnd: number
  end: DonutFillEnd
}

const toPathUnits = (length: number) => (length / DONUT.circumference) * 100

/**
 * Where the donut fill is drawn for `valueRatio` against a notch at `requiredRatio`.
 *
 * Near the notch the end snaps to one of three states, so the notch casing never leaves a teal
 * sliver past it or a hairline of track before it: flush on the notch (met, less than half a cap
 * past), a round cap centred on the notch (met, within a cap), or a round tip a clear gap short of
 * the casing (unmet). `null` when nothing is filled.
 */
export function donutFill(valueRatio: number, requiredRatio: number | null): DonutFill | null {
  if (valueRatio <= 0) {
    return null
  }
  if (valueRatio >= 1) {
    return { arcStart: 0, arcEnd: 100, end: "full" }
  }
  const { capRadius, circumference, casingWidth, notchGap } = DONUT
  let tip = valueRatio * circumference
  let end: DonutFillEnd = "round"
  if (requiredRatio !== null) {
    const notch = requiredRatio * circumference
    const pastNotch = tip - notch
    const clearTip = notch - casingWidth / 2 - notchGap
    if (pastNotch >= 0 && pastNotch < capRadius / 2) {
      tip = notch
      end = "flush"
    } else if (pastNotch >= 0 && pastNotch < capRadius) {
      tip = notch + capRadius
    } else if (pastNotch < 0 && tip > clearTip) {
      tip = clearTip
    }
  }
  if (tip >= circumference) {
    return { arcStart: 0, arcEnd: 100, end: "full" }
  }
  const arcStart = toPathUnits(capRadius)
  const arcEnd = Math.max(toPathUnits(end === "round" ? tip - capRadius : tip), arcStart)
  return { arcStart, arcEnd, end }
}

// Tick is 4px wide with a 1px casing; 3px of track stays visible before it.
const BAR_TICK_CLEARANCE_PX = 2 + 1 + 3

/**
 * CSS width of the exercises bar fill. Near the tick the rounded end is pinned in pixels, so the
 * result reads the same at every bar width: a met fill's end cap is centred on the tick at least,
 * and an unmet fill stops a clear gap before it. `--bar-height` must be set on the track.
 */
export function barFillWidth(valueRatio: number, requiredRatio: number | null): string {
  const value = `${valueRatio * 100}%`
  if (requiredRatio === null) {
    return value
  }
  const tick = `${requiredRatio * 100}%`
  return valueRatio >= requiredRatio
    ? `max(${value}, calc(${tick} + var(--bar-height) / 2))`
    : `min(${value}, calc(${tick} - ${BAR_TICK_CLEARANCE_PX}px))`
}
