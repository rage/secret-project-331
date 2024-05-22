import { css } from "@emotion/css"
import React, { useContext } from "react"

import Spinner from "@/shared-module/common/components/Spinner"
import IframeHeightContext from "@/shared-module/common/contexts/IframeHeightContext"

const DynamicallyLoadingComponentPlaceholder = () => {
  let iframeHeight = useContext(IframeHeightContext).height
  if (iframeHeight < 68) {
    iframeHeight = 68
  }
  return (
    <div
      className={css`
        height: ${iframeHeight}px;
      `}
    >
      <Spinner variant="medium" />
    </div>
  )
}

export default DynamicallyLoadingComponentPlaceholder
