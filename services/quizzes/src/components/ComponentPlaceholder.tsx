"use client"

import { css } from "@emotion/css"
import { useContext, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import Spinner from "@/shared-module/common/components/Spinner"
import IframeHeightContext from "@/shared-module/common/contexts/IframeHeightContext"

const QUIZZES_DYNAMIC_LOADING_SLOW_WARNING_KEY = "quizzes-dynamic-loading-slow-warning"
const QUIZZES_DYNAMIC_LOADING_VERY_SLOW_WARNING_KEY = "quizzes-dynamic-loading-very-slow-warning"
const QUIZZES_DYNAMIC_LOADING_SLOW_WARNING_FALLBACK =
  "Loading a part of the application is taking longer than expected."
const QUIZZES_DYNAMIC_LOADING_VERY_SLOW_WARNING_FALLBACK =
  "This may be due to network issues. If loading does not finish soon, please reload the page."

const loadingWarningTextClass = css`
  margin: 0.25rem 0 0;
  max-width: 28rem;
  text-align: center;
  color: #4b5563;
`

const loadingWarningBoxClass = css`
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  background-color: #f9fafb;
`

const DynamicallyLoadingComponentPlaceholder = () => {
  const [showSlowWarning, setShowSlowWarning] = useState(false)
  const [showVerySlowWarning, setShowVerySlowWarning] = useState(false)
  const { t } = useTranslation()

  const slowWarningText =
    t(QUIZZES_DYNAMIC_LOADING_SLOW_WARNING_KEY) === QUIZZES_DYNAMIC_LOADING_SLOW_WARNING_KEY
      ? QUIZZES_DYNAMIC_LOADING_SLOW_WARNING_FALLBACK
      : t(QUIZZES_DYNAMIC_LOADING_SLOW_WARNING_KEY)

  const verySlowWarningText =
    t(QUIZZES_DYNAMIC_LOADING_VERY_SLOW_WARNING_KEY) ===
    QUIZZES_DYNAMIC_LOADING_VERY_SLOW_WARNING_KEY
      ? QUIZZES_DYNAMIC_LOADING_VERY_SLOW_WARNING_FALLBACK
      : t(QUIZZES_DYNAMIC_LOADING_VERY_SLOW_WARNING_KEY)

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

  let iframeHeight = useContext(IframeHeightContext).height
  if (iframeHeight < 68) {
    iframeHeight = 68
  }

  const showAnyWarning = showSlowWarning || showVerySlowWarning

  return (
    <div
      className={css`
        height: ${iframeHeight}px;
      `}
    >
      <Spinner variant="placeholder" />
      {showAnyWarning && (
        <div className={loadingWarningBoxClass}>
          {showSlowWarning && <p className={loadingWarningTextClass}>{slowWarningText}</p>}
          {showVerySlowWarning && <p className={loadingWarningTextClass}>{verySlowWarningText}</p>}
        </div>
      )}
    </div>
  )
}

export default DynamicallyLoadingComponentPlaceholder
