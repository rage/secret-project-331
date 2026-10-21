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

const READABILITY_SHADOW = `
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.55),
    0 0 6px rgba(0, 0, 0, 0.4);
  paint-order: stroke fill;
`

const NO_READABILITY_SHADOW = `
  text-shadow: none;
`

/**
 * Declarations that keep hero text legible over an author-supplied background image (WCAG 1.4.3).
 * Pass the image that applies at the breakpoint being styled; a hero with none gets no shadow.
 *
 * `text-shadow` inherits, so one call on the text container covers every heading and line inside.
 */
export const heroTextReadabilityCss = (backgroundImageUrl: string | undefined): string =>
  backgroundImageUrl ? READABILITY_SHADOW : NO_READABILITY_SHADOW
