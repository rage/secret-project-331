const colorMapper = [
  ["black", "#000000"],
  ["vivid-red", "#fc2403"],
  ["cyan-bluish-gray", "#E0FFFF"],
  ["white", "#FFFFFF"],
  ["pale-pink", "#FFC0CB"],
  ["luminous-vivid-orange", "#FF7F50"],
  ["luminous-vivid-amber", "#FFBF00"],
  ["light-green-cyan", "#00FA9A"],
  ["vivid-green-cyan", "#7FFF00"],
  ["pale-cyan-blue", "#66CDAA"],
  ["vivid-cyan-blue", "#00FFFF"],
  ["vivid-purple", "#800080"],
]

const gradientColorMapper = [
  ["vivid-cyan-blue-to-vivid-purple", "linear-gradient(135deg, #0693e3 0%, #9b51e0 100%)"],
  ["light-green-cyan-to-vivid-green-cyan", "linear-gradient(135deg, #7adcb4 0%, #00d082 100%)"],
  [
    "luminous-vivid-amber-to-luminous-vivid-orange",
    "linear-gradient(135deg, #fcb900 0%, #ff6900 100%)",
  ],
  ["luminous-vivid-orange-to-vivid-red", "linear-gradient(135deg, #ff6900 0%, #cf2e2e 100%)"],
  ["very-light-gray-to-cyan-bluish-gray", "linear-gradient(135deg, #eeeeee 0%, #a9b8c3 100%)"],
  [
    "cool-to-warm-spectrum",
    "linear-gradient(135deg, #4aeadc 0%, #9778d1 20%, #cf2aba 40%, #ee2c82 60%, #fb6962 80%, #fef84c 100%)",
  ],
  ["blush-bordeaux", "linear-gradient(135deg, #fecda5 0%, #fe2d2d 50%, #6b003e 100%)"],
  ["luminous-dusk", "linear-gradient(135deg, #ffcb70 0%, #c751c0 50%, #4158d0 100%)"],
  ["pale-ocean", "linear-gradient(135deg, #fff5cb 0%, #b6e3d4 50%, #33a7b5 100%)"],
  ["electric-grass", "linear-gradient(135deg, #caf880 0%, #71ce7e 100%)"],
  ["midnight", "linear-gradient(135deg, #020381 0%, #2874fc 100%)"],
  ["blush-light-purple", "linear-gradient(135deg, #ffceec 0%, #9896f0 100%)"],
]

const ColorMapper = (colorName: string) => {
  let colorArray = colorMapper.find((color) => color[0] === colorName)

  colorArray === undefined
    ? (colorArray = gradientColorMapper.find((color) => color[0] === colorName))
    : null

  colorArray === undefined ? (colorArray = ["black", "#000000"]) : null
  const colorCode = colorArray[1]
  return colorCode
}

export default ColorMapper
