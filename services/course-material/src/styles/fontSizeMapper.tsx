/* eslint-disable i18next/no-literal-string */

// Gutenberg specific, don't use in other contexes

const fontSizes: { [fontName: string]: string | undefined } = {
  small: "16px",
  normal: "20px",
  medium: "24px",
  large: "36px",
  huge: "42px",
}

const mobileFontSizes: { [fontName: string]: string | undefined } = {
  small: "15px",
  normal: "18px",
  medium: "22px",
  large: "30px",
  huge: "34px",
}

const DEFAULT_FONT_SIZE = "20px"
const MOBILE_DEFUALT_FONT_SIZE = "18px"

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

const mobileFontSizeMapper = (fontName: string | undefined): string => {
  if (!fontName) {
    return MOBILE_DEFUALT_FONT_SIZE
  }
  const fontSize = mobileFontSizes[fontName]

  if (!fontSize) {
    return MOBILE_DEFUALT_FONT_SIZE
  }

  return fontSize
}

export { fontSizeMapper, mobileFontSizeMapper }
