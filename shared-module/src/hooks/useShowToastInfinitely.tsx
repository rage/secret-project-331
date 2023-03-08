import { useEffect, useState } from "react"

import {
  SHOW_TOAS_INIFINITELY_IN_SYSTEM_TESTS_EVENT,
  SHOW_TOAST_DURATION_IN_SYSTEM_TESTS_EVENT,
} from "../utils/constants"

export default function useSetShowStuffInfinitelyInSystemTestScreenshots(): boolean {
  const [shouldShowStuffInfinitely, setShouldShowStuffInfinitely] = useState(false)
  useEffect(() => {
    const setShowInfinitelyCallback = () => {
      setShouldShowStuffInfinitely(true)
    }
    const setShowDuration = () => {
      setShouldShowStuffInfinitely(false)
    }
    window.addEventListener(SHOW_TOAS_INIFINITELY_IN_SYSTEM_TESTS_EVENT, setShowInfinitelyCallback)
    window.addEventListener(SHOW_TOAST_DURATION_IN_SYSTEM_TESTS_EVENT, setShowDuration)
    return () => {
      window.removeEventListener(
        SHOW_TOAS_INIFINITELY_IN_SYSTEM_TESTS_EVENT,
        setShowInfinitelyCallback,
      )
      window.removeEventListener(SHOW_TOAST_DURATION_IN_SYSTEM_TESTS_EVENT, setShowDuration)
    }
  }, [])
  return shouldShowStuffInfinitely
}
