import KaTex from "katex"

import "katex/dist/katex.min.css"
import { BlockRendererProps } from ".."
import withErrorBoundary from "../../../shared-module/common/utils/withErrorBoundary"

export interface TextAttributes {
  text: string
}

const KATEX_OUTPUT_FORMAT = "htmlAndMathml"

const LatexBlock: React.FC<React.PropsWithChildren<BlockRendererProps<TextAttributes>>> = ({
  data,
}) => {
  const attributes: TextAttributes = data.attributes

  const convert_to_latex = () => {
    const output = KaTex.renderToString(attributes.text, {
      throwOnError: false,
      displayMode: true,
      output: KATEX_OUTPUT_FORMAT,
    })
    return <div dangerouslySetInnerHTML={{ __html: output }} />
  }
  return <div>{convert_to_latex()}</div>
}

export default withErrorBoundary(LatexBlock)
