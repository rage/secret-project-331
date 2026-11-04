/**
 * Gutenberg's default colour palette by slug, which rich text names in `has-<slug>-color`
 * classes. The CMS tests that it still matches the palette its editor offers.
 */
export const GUTENBERG_COLOR_PALETTE: Readonly<Record<string, string>> = {
  black: "#000000",
  "cyan-bluish-gray": "#ABB8C3",
  white: "#FFFFFF",
  "pale-pink": "#F78DA7",
  "vivid-red": "#CF2E2E",
  "luminous-vivid-orange": "#FF6900",
  "luminous-vivid-amber": "#FCB900",
  "light-green-cyan": "#7BDCB5",
  "vivid-green-cyan": "#00D084",
  "pale-cyan-blue": "#8ED1FC",
  "vivid-cyan-blue": "#0693E3",
  "vivid-purple": "#9B51E0",
}
