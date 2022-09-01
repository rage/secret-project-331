import React from "react"

import useShouldHideStuffFromSystemTestScreenshots from "../../hooks/useShouldHideStuffForSystemTestScreenshots"

interface HideChildrenInSystemTestsProps {
  children: React.ReactNode
}

// If you have something that gets in the way in the system tests screenshots
const HideTextInSystemTests: React.FC<HideChildrenInSystemTestsProps> = ({ children }) => {
  const shouldHideStuff = useShouldHideStuffFromSystemTestScreenshots()
  if (shouldHideStuff) {
    return null
  }
  return <>{children}</>
}

export default HideTextInSystemTests
