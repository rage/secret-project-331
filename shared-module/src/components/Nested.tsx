import { css } from "@emotion/css"
import React from "react"

const Nested: React.FC = (_props) => {
  return (
    <div
      className={css`
        p {
          color: rebeccapurple;
        }
      `}
    >
      <p>I&apos;m a nested paragraph</p>
    </div>
  )
}

export default Nested
