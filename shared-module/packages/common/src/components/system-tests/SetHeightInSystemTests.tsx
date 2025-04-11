import { css } from "@emotion/css"
import React from "react"

import useShouldHideStuffFromSystemTestScreenshots from "../../hooks/useShouldHideStuffForSystemTestScreenshots"

interface SetHeightInSystemTestsProps {
  children: React.ReactNode
  heightPx: number
}

/** Makes the height of the element to be fixed when taking system test screenshots. */
const SetHeightInSystemTests: React.FC<SetHeightInSystemTestsProps> = ({ children, heightPx }) => {
  const shouldHideStuff = useShouldHideStuffFromSystemTestScreenshots()

  if (shouldHideStuff) {
    return (
      <div
        className={css`
          height: ${heightPx}px !important;
          overflow: hidden !important;
        `}
      ></div>
    )
  }

  return <>{children}</>
}

export default SetHeightInSystemTests
