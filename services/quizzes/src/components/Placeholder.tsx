import { css } from "@emotion/css"
import React, { useContext } from "react"

import IframeHeightContext from "../shared-module/contexts/IframeHeightContext"

const PLACEHOLDER = "placeholder"

const Placeholder = () => {
  const iframeHeight = useContext(IframeHeightContext).height
  return (
    <div
      className={css`
        height: ${iframeHeight};
      `}
    >
      {PLACEHOLDER}
    </div>
  )
}

export default Placeholder
