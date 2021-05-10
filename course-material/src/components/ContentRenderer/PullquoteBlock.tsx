import { css } from "@emotion/css"
import styled from "@emotion/styled"
import sanitizeHtml from "sanitize-html"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"

interface PullquoteBlockAttributes {
  value: string
  citation: string
  className: string
  mainColor?: string
  customMainColor?: string
  textColor?: string
}

const Figure = styled.figure`
background-color: ${props => (props.attributes.className === "is-style-solid-color" ? props.currentColor: null)};
border-bottom: 4px solid ${props => (props.attributes.className === "is-style-default" ? props.currentColor : null)};
border-top: 4px solid ${props => (props.attributes.className === "is-style-default" ? props.currentColor : null)};
margin-bottom: 1.75em;
`

const Blockquote = styled.blockquote`
text-color: ${props => props.currentColor};
padding: 3em 0;
text-align: center;
`

const textColorMapper = [
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


const PullquoteBlock: React.FC<BlockRendererProps<PullquoteBlockAttributes>> = ({ data }) => {
  const attributes: PullquoteBlockAttributes = data.attributes


  var mainColor = attributes.customMainColor !== undefined 
  ? attributes.customMainColor
  : "#FFFFFF"

  mainColor = attributes.mainColor !== undefined 
  ? textColorMapper.find(color => color[0] === attributes.mainColor)[1]
  : "#FFFFFF"

  const textColor = attributes.textColor !== undefined
  ? textColorMapper.find(color => color[0] === attributes.textColor)[1]
  : "#000000"

  const value = attributes.value !== undefined
  ? attributes.value
  : "<p></p>"

  return (
        <Figure currentColor={mainColor} attributes={attributes} className={css`
        ${normalWidthCenteredComponentStyles}
      `}>
          <Blockquote currentColor={textColor}>
            <div>
              <p style={{fontSize: "28px"}} dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }}></p>
               </div>
            <cite>{attributes.citation}</cite>
          </Blockquote>
        </Figure>
  )
}

export default PullquoteBlock
