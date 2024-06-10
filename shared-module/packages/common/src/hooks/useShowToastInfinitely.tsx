import { useEffect, useState } from "react"

import {
  SHOW_TOASTS_INIFINITELY_IN_SYSTEM_TESTS_EVENT,
  SHOW_TOASTS_NORMALLY_IN_SYSTEM_TESTS_EVENT,
} from "../utils/constants"

export default function useSetShowStuffInfinitelyInSystemTestScreenshots(): boolean {
  const [shouldShowStuffInfinitely, setShouldShowStuffInfinitely] = useState(false)
  useEffect(() => {
    const setShowInfinitelyCallback = () => {
      setShouldShowStuffInfinitely(true)
    }
    const setShowNormally = () => {
      setShouldShowStuffInfinitely(false)
    }
    window.addEventListener(
      SHOW_TOASTS_INIFINITELY_IN_SYSTEM_TESTS_EVENT,
      setShowInfinitelyCallback,
    )
    window.addEventListener(SHOW_TOASTS_NORMALLY_IN_SYSTEM_TESTS_EVENT, setShowNormally)
    return () => {
      window.removeEventListener(
        SHOW_TOASTS_INIFINITELY_IN_SYSTEM_TESTS_EVENT,
        setShowInfinitelyCallback,
      )
      window.removeEventListener(SHOW_TOASTS_NORMALLY_IN_SYSTEM_TESTS_EVENT, setShowNormally)
    }
  }, [])
  return shouldShowStuffInfinitely
}
