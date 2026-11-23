export type Rgb = [number, number, number]

/** Channels of a `#rgb`, `#rrggbb` (alpha ignored) or `rgb()`/`rgba()` colour, else `undefined`. */
export const parseRgb = (color: string): Rgb | undefined => {
  const value = color.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(value)?.[1]
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(value)
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  }
  return undefined
}

/** WCAG relative luminance of a colour `parseRgb` accepts, `undefined` when it cannot be parsed. */
export const relativeLuminance = (color: string): number | undefined => {
  const rgb = parseRgb(color)
  if (!rgb) {
    return undefined
  }
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as Rgb
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio of two colours, `undefined` when either cannot be parsed. */
export const contrastRatio = (a: string, b: string): number | undefined => {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  if (la === undefined || lb === undefined) {
    return undefined
  }
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
