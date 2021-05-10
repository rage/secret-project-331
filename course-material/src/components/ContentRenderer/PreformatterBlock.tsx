import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import styled from "@emotion/styled"

interface PreformatterBlockAttributes {
  content: string
  gradient?: string
  backgroundColor?: string
  textColor?: string
  fontSize?: string
}

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

const fontSizeMapper = [
  ["small", "13px"],
  ["normal", "16px"],
  ["medium", "24px"],
  ["large", "30px"],
  ["huge", "36px"],
]

const Pre = styled.pre`
  background: ${(props) =>
    props.attributes.gradient !== undefined
      ? chooseColor([props.attributes.gradient, "gradient"])
      : chooseColor([props.attributes.backgroundColor, "solid"])};
  padding: 1.25em 2.375em;
`

const Blockquote = styled.blockquote`
  text-color: ${(props) => props.currentColor};
  text-align: center;
`
const chooseColor = (props) => {
  let backgroundColor
  if (props[0] === undefined) {
    return "#FFFFFF"
  }
  if (props[1] === "solid") {
    backgroundColor = colorMapper.find((color) => color[0] === props[0])[1]
  } else {
    backgroundColor = gradientColorMapper.find((color) => color[0] === props[0])[1]
  }
  console.log(backgroundColor)
  return backgroundColor
}

const PreformatterBlock: React.FC<BlockRendererProps<PreformatterBlockAttributes>> = ({ data }) => {
  const attributes: PreformatterBlockAttributes = data.attributes

  const textColor =
    attributes.textColor !== undefined
      ? colorMapper.find((color) => color[0] === attributes.textColor)[1]
      : "#000000"

  const fontSize =
    attributes.fontSize !== undefined
      ? fontSizeMapper.find((fontSize) => fontSize[0] === attributes.fontSize)[1]
      : "16px"

  return (
    <Pre
      attributes={attributes}
      className={css`
        ${normalWidthCenteredComponentStyles}
        color: ${textColor};
        font-size: ${fontSize};
        white-space: pre-line;
      `}
    >
      <div style={{ overflowWrap: "break-word" }}> {attributes.content} </div>
    </Pre>
  )
}

export default PreformatterBlock
