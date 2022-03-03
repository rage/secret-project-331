import { css } from "@emotion/css"
import React from "react"

export interface BlockquoteComponentProps {
  bodyText: string
  cite: string
}

const Aside: React.FC<BlockquoteComponentProps> = ({ bodyText, cite }) => {
  return (
    <blockquote
      cite={cite}
      className={css`
        margin-left: 1.5em;
      `}
    >
      {bodyText}
    </blockquote>
  )
}

export default Aside
