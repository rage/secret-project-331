"use client"

import { css } from "@emotion/css"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import Spinner from "../../components/Spinner"
import { baseTheme } from "../../styles"

const DYNAMIC_LOADING_SLOW_WARNING_KEY = "dynamic-loading-slow-warning"
const DYNAMIC_LOADING_VERY_SLOW_WARNING_KEY = "dynamic-loading-very-slow-warning"
const DYNAMIC_LOADING_SLOW_WARNING_FALLBACK =
  "Loading a part of the application is taking longer than expected."
const DYNAMIC_LOADING_VERY_SLOW_WARNING_FALLBACK =
  "This may be due to network issues. If loading does not finish soon, please reload the page."

const loadingWarningTextClass = css`
  margin: 0.25rem 0 0;
  max-width: 28rem;
  text-align: center;
  color: ${baseTheme.colors.gray[800]};
`

const loadingWarningBoxClass = css`
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  background-color: ${baseTheme.colors.gray[25]};
`

/**
 * Loading state component that shows a spinner and escalates warnings
 * if loading takes longer than expected.
 */
const LoadingState = () => {
  const [showSlowWarning, setShowSlowWarning] = useState(false)
  const [showVerySlowWarning, setShowVerySlowWarning] = useState(false)
  const { t } = useTranslation()

  const slowWarningText =
    t(DYNAMIC_LOADING_SLOW_WARNING_KEY) === DYNAMIC_LOADING_SLOW_WARNING_KEY
      ? DYNAMIC_LOADING_SLOW_WARNING_FALLBACK
      : t(DYNAMIC_LOADING_SLOW_WARNING_KEY)

  const verySlowWarningText =
    t(DYNAMIC_LOADING_VERY_SLOW_WARNING_KEY) === DYNAMIC_LOADING_VERY_SLOW_WARNING_KEY
      ? DYNAMIC_LOADING_VERY_SLOW_WARNING_FALLBACK
      : t(DYNAMIC_LOADING_VERY_SLOW_WARNING_KEY)

  useEffect(() => {
    const slowTimeout = setTimeout(() => {
      setShowSlowWarning(true)
    }, 5000)

    const verySlowTimeout = setTimeout(() => {
      setShowVerySlowWarning(true)
    }, 30000)

    return () => {
      clearTimeout(slowTimeout)
      clearTimeout(verySlowTimeout)
    }
  }, [])

  const showAnyWarning = showSlowWarning || showVerySlowWarning

  return (
    <div>
      <Spinner />
      {showAnyWarning && (
        <div className={loadingWarningBoxClass}>
          {showSlowWarning && <p className={loadingWarningTextClass}>{slowWarningText}</p>}
          {showVerySlowWarning && <p className={loadingWarningTextClass}>{verySlowWarningText}</p>}
        </div>
      )}
    </div>
  )
}

export default LoadingState
