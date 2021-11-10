import React, { DetailedHTMLProps, HTMLAttributes } from "react"
import "katex/dist/katex.min.css"

const LatexParagraph: React.FC<
  DetailedHTMLProps<HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>
> = (props) => <p {...props} />

export default LatexParagraph
