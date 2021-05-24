const fontSizes: { [colorName: string]: string | undefined } = {
  small: "13px",
  normal: "16px",
  medium: "24px",
  large: "30px",
  huge: "36px",
}

const DEFAULT_FONT_SIZE = "16px"

const FontSizeMapper = (fontName: string | undefined): string => {
  if (!fontName) {
    return DEFAULT_FONT_SIZE
  }
  const fontSize = fontSizes[fontName]

  if (!fontSize) {
    return DEFAULT_FONT_SIZE
  }

  return fontSize
}

export default FontSizeMapper
