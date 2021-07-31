import KaTex from "katex"

import { BlockRendererProps } from "."
import "katex/dist/katex.min.css"

export interface TextAttributes {
  text: string
}

const LatexBlock: React.FC<BlockRendererProps<TextAttributes>> = ({ data }) => {
  const attributes: TextAttributes = data.attributes

  const convert_to_latex = () => {
    const output = KaTex.renderToString(attributes.text, {
      throwOnError: false,
      displayMode: true,
      output: "html",
    })
    return <div dangerouslySetInnerHTML={{ __html: output }} />
  }
  return <div>{convert_to_latex()}</div>
}

export default LatexBlock
