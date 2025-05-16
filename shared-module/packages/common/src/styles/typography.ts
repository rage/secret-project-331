// These fallback variables should not used outside of this file.
// Fallback fonts are used as a temporary fallback before the browser has
// loaded the fonts included in the webpage. They also might be used for some
// characters that our main fonts don't support, like emojis. It is just a list
// of common default fonts. Adapted from reboot.css.
const fallbackFontsSansSerif = `system-ui, -apple-system, Cantarell, Ubuntu, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`
const fallbackFontsMonospace = `ui-monospace, "Source Code Pro", "Ubuntu Mono", SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`

export const secondaryFont = `"Inter Variable", Inter, ${fallbackFontsSansSerif}`
export const primaryFont = `"Inter Variable", Inter, ${fallbackFontsSansSerif}`
export const headingFont = `"Raleway", ${fallbackFontsSansSerif}`
export const monospaceFont = `"Space Mono", ${fallbackFontsMonospace}`

export const typography = {
  h1: "clamp(40px, 8vw, 90px)",
  h2: "clamp(32px, 6vw, 60px)",
  h3: "clamp(26px, 4vw, 48px)",
  h4: "clamp(24px, 3vw, 34px)",
  h5: "clamp(22px, 2.4vw, 24px)",
  h6: "clamp(18px, 2vw, 20px)",
  paragraph: "1.1rem",
  helperText: "0.8rem",
  copyrightText: "0.7rem",
}

export const fontWeights = {
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
}
