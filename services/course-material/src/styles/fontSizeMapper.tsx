/* eslint-disable i18next/no-literal-string */

// Gutenberg specific, don't use in other contexes

const fontSizes: { [colorName: string]: string | undefined } = {
  small: "13px",
  normal: "16px",
  medium: "20px",
  large: "36px",
  huge: "42px",
}

const DEFAULT_FONT_SIZE = "16px"

const fontSizeMapper = (fontName: string | undefined): string => {
  if (!fontName) {
    return DEFAULT_FONT_SIZE
  }
  const fontSize = fontSizes[fontName]

  if (!fontSize) {
    return DEFAULT_FONT_SIZE
  }

  return fontSize
}

export default fontSizeMapper
