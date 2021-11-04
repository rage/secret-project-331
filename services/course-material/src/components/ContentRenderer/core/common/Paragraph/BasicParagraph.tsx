import React, { DetailedHTMLProps, HTMLAttributes } from "react"

const BasicParagraph: React.FC<
  DetailedHTMLProps<HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>
> = (props) => <p {...props} />

export default BasicParagraph
