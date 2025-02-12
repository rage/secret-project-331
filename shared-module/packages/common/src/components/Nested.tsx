import { css } from "@emotion/css"
import React from "react"

const PLACEHOLDER_TEXT = "I'm a nested paragraph"

const Nested: React.FC<React.PropsWithChildren<unknown>> = (_props) => {
  return (
    <div
      className={css`
        p {
          color: rebeccapurple;
        }
      `}
    >
      <p>{PLACEHOLDER_TEXT}</p>
    </div>
  )
}

export default Nested
