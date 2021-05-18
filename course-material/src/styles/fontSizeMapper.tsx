const fontSizes = [
  ["small", "13px"],
  ["normal", "16px"],
  ["medium", "24px"],
  ["large", "30px"],
  ["huge", "36px"],
]

const FontSizeMapper = (fontName: string | undefined) => {
  const fontSize =
    fontName !== undefined ? fontSizes.find((fontSize) => fontSize[0] === fontName)[1] : "16px"

  return fontSize
}

export default FontSizeMapper
