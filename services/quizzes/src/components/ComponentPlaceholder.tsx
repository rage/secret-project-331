import { css } from "@emotion/css"
import React, { useContext } from "react"

import Spinner from "../shared-module/components/Spinner"
import IframeHeightContext from "../shared-module/contexts/IframeHeightContext"

const DynamicallyLoadingComponentPlaceholder = () => {
  const iframeHeight = useContext(IframeHeightContext).height
  return (
    <div
      className={css`
        height: ${iframeHeight};
      `}
    >
      <Spinner variant="medium" />
    </div>
  )
}

export default DynamicallyLoadingComponentPlaceholder
