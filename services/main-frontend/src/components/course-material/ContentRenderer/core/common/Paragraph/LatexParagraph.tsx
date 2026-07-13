"use client"

import type { DetailedHTMLProps, HTMLAttributes } from "react"
import React from "react"
import "katex/dist/katex.min.css"

const LatexParagraph: React.FC<
  React.PropsWithChildren<
    DetailedHTMLProps<HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>
  >
> = (props) => <p {...props} />

export default LatexParagraph
