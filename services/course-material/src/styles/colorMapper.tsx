/* eslint-disable i18next/no-literal-string */
// Gutenberg specific, don't use in other contexes

export const colorMap: { [colorName: string]: string | undefined } = {
  black: "#000000",
  "cyan-bluish-gray": "#ABB8C3",
  white: "#FFFFFF",
  "pale-pink": "#F78DA7",
  "vivid-red": "#CF2E2E",
  "luminous-vivid-orange": "#F78DA7",
  "luminous-vivid-amber": "#FCB900",
  "light-green-cyan": "#7BDCB5",
  "vivid-green-cyan": "#00D084",
  "pale-cyan-blue": "#8ED1FC",
  "vivid-cyan-blue": "#0693E3",
  "vivid-purple": "#9B51E0",
}

const gradientColorMap: { [colorName: string]: string | undefined } = {
  "vivid-cyan-blue-to-vivid-purple": "linear-gradient(135deg, #0693e3 0%, #9b51e0 100%)",
  "light-green-cyan-to-vivid-green-cyan": "linear-gradient(135deg, #7adcb4 0%, #00d082 100%)",
  "luminous-vivid-amber-to-luminous-vivid-orange":
    "linear-gradient(135deg, #fcb900 0%, #ff6900 100%)",
  "luminous-vivid-orange-to-vivid-red": "linear-gradient(135deg, #ff6900 0%, #cf2e2e 100%)",
  "very-light-gray-to-cyan-bluish-gray": "linear-gradient(135deg, #eeeeee 0%, #a9b8c3 100%)",
  "cool-to-warm-spectrum":
    "linear-gradient(135deg, #4aeadc 0%, #9778d1 20%, #cf2aba 40%, #ee2c82 60%, #fb6962 80%, #fef84c 100%)",
  "blush-bordeaux": "linear-gradient(135deg, #fecda5 0%, #fe2d2d 50%, #6b003e 100%)",
  "luminous-dusk": "linear-gradient(135deg, #ffcb70 0%, #c751c0 50%, #4158d0 100%)",
  "pale-ocean": "linear-gradient(135deg, #fff5cb 0%, #b6e3d4 50%, #33a7b5 100%)",
  "electric-grass": "linear-gradient(135deg, #caf880 0%, #71ce7e 100%)",
  midnight: "linear-gradient(135deg, #020381 0%, #2874fc 100%)",
  "blush-light-purple": "linear-gradient(135deg, #ffceec 0%, #9896f0 100%)",
}

// Returns a css color
const colorMapper = (colorName: string | undefined, defaultColor = "unset"): string => {
  if (!colorName) {
    return defaultColor
  }
  let cssColor = colorMap[colorName]

  if (!cssColor) {
    cssColor = gradientColorMap[colorName]
  }

  if (!cssColor) {
    return defaultColor
  }

  return cssColor
}

export default colorMapper
