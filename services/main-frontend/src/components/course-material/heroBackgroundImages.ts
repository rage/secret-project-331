/** The background image that applies at each breakpoint, `undefined` where the hero has none. */
export interface HeroBackgroundImages {
  mobile: string | undefined
  medium: string | undefined
  large: string | undefined
  xlarge: string | undefined
}

/** The background images an author set on a hero block, `undefined` where they set none. */
export interface AuthoredHeroBackgroundImages {
  backgroundImage: string | undefined
  backgroundImageMedium: string | undefined
  backgroundImageLarge: string | undefined
  backgroundImageXLarge: string | undefined
}

/**
 * Resolves the author's per-breakpoint background images, each falling back to the next narrower
 * one that was set.
 */
export const resolveHeroBackgroundImages = ({
  backgroundImage,
  backgroundImageMedium,
  backgroundImageLarge,
  backgroundImageXLarge,
}: AuthoredHeroBackgroundImages): HeroBackgroundImages => ({
  mobile: backgroundImage,
  medium: backgroundImageMedium || backgroundImage,
  large: backgroundImageLarge || backgroundImageMedium || backgroundImage,
  xlarge: backgroundImageXLarge || backgroundImageLarge || backgroundImageMedium || backgroundImage,
})

const haloShadow = (rgb: string) => `
  text-shadow:
    0 1px 2px rgba(${rgb}, 0.55),
    0 0 6px rgba(${rgb}, 0.4);
  paint-order: stroke fill;
`

const DARK_HALO = haloShadow("0, 0, 0")
const LIGHT_HALO = haloShadow("255, 255, 255")

// Text colour used when the author set none; matches baseTheme.colors.gray[700].
const DEFAULT_HERO_TEXT_COLOR = "#1a2333"
// Luminance where black and white text have equal contrast.
const LUMINANCE_THRESHOLD = 0.179

const parseRgb = (color: string): [number, number, number] | undefined => {
  const value = color.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(value)?.[1]
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(value)
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  }
  return undefined
}

/** WCAG relative luminance of a hex or rgb() colour, `undefined` when it cannot be parsed. */
export const relativeLuminance = (color: string): number | undefined => {
  const rgb = parseRgb(color)
  if (!rgb) {
    return undefined
  }
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const NO_READABILITY_SHADOW = `
  text-shadow: none;
`

/**
 * Declarations that keep hero text legible over an author-supplied background image (WCAG 1.4.3).
 * Pass the image that applies at the breakpoint being styled; a hero with none gets no shadow.
 * The halo is dark around light text and light around dark text; an unparseable text colour keeps
 * the dark halo.
 *
 * `text-shadow` inherits, so one call on the text container covers every heading and line inside.
 */
export const heroTextReadabilityCss = (
  backgroundImageUrl: string | undefined,
  textColor?: string,
): string => {
  if (!backgroundImageUrl) {
    return NO_READABILITY_SHADOW
  }
  const luminance = relativeLuminance(textColor || DEFAULT_HERO_TEXT_COLOR)
  return luminance !== undefined && luminance <= LUMINANCE_THRESHOLD ? LIGHT_HALO : DARK_HALO
}
