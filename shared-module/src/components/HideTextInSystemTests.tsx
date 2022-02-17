import React, { useEffect, useState } from "react"

import {
  HIDE_TEXT_IN_SYSTEM_TESTS_EVENT,
  SHOW_TEXT_IN_SYSTEM_TESTS_EVENT,
} from "../utils/constants"

interface HideTextInSystemTestProps {
  text: string
  testPlaceholder: string
}

// IF you have dynamic data that should be hidden in system tests, like timestamps using this comonent will hide hide the information automatically whenever a system test takes a screenshot.
const HideTextInSystemTests: React.FC<HideTextInSystemTestProps> = ({ text, testPlaceholder }) => {
  const [showPlaceholder, setShowPlaceholder] = useState(false)
  useEffect(() => {
    const hideCallback = () => {
      setShowPlaceholder(true)
    }
    const showCallback = () => {
      setShowPlaceholder(false)
    }
    window.addEventListener(HIDE_TEXT_IN_SYSTEM_TESTS_EVENT, hideCallback)
    window.addEventListener(SHOW_TEXT_IN_SYSTEM_TESTS_EVENT, showCallback)
    return () => {
      window.removeEventListener(HIDE_TEXT_IN_SYSTEM_TESTS_EVENT, hideCallback)
      window.removeEventListener(SHOW_TEXT_IN_SYSTEM_TESTS_EVENT, showCallback)
    }
  }, [])
  if (showPlaceholder) {
    return <>{testPlaceholder}</>
  }
  return <>{text}</>
}

export default HideTextInSystemTests
