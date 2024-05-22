import { useEffect, useState } from "react"

import {
  HIDE_TEXT_IN_SYSTEM_TESTS_EVENT,
  SHOW_TEXT_IN_SYSTEM_TESTS_EVENT,
} from "../utils/constants"

export default function useShouldHideStuffFromSystemTestScreenshots(): boolean {
  const [shouldHideStuff, setShouldHideStuff] = useState(false)
  useEffect(() => {
    const hideCallback = () => {
      setShouldHideStuff(true)
    }
    const showCallback = () => {
      setShouldHideStuff(false)
    }
    window.addEventListener(HIDE_TEXT_IN_SYSTEM_TESTS_EVENT, hideCallback)
    window.addEventListener(SHOW_TEXT_IN_SYSTEM_TESTS_EVENT, showCallback)
    return () => {
      window.removeEventListener(HIDE_TEXT_IN_SYSTEM_TESTS_EVENT, hideCallback)
      window.removeEventListener(SHOW_TEXT_IN_SYSTEM_TESTS_EVENT, showCallback)
    }
  }, [])
  return shouldHideStuff
}
