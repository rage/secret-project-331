import React from "react"

import useShouldHideStuffFromSystemTestScreenshots from "../../hooks/useShouldHideStuffForSystemTestScreenshots"

interface HideTextInSystemTestProps {
  text: string
  testPlaceholder: string
}

// IF you have dynamic data that should be hidden in system tests, like timestamps using this comonent will hide hide the information automatically whenever a system test takes a screenshot.
const HideTextInSystemTests: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<HideTextInSystemTestProps>>
> = ({ text, testPlaceholder }) => {
  const shouldHideStuff = useShouldHideStuffFromSystemTestScreenshots()
  if (shouldHideStuff) {
    return <>{testPlaceholder}</>
  }
  return <>{text}</>
}

export default HideTextInSystemTests
