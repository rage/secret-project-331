import React, { DetailedHTMLProps, HTMLAttributes } from "react"

const BasicParagraph: React.FC<
  React.PropsWithChildren<
    DetailedHTMLProps<HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>
  >
> = (props) => <p {...props} />

export default BasicParagraph
