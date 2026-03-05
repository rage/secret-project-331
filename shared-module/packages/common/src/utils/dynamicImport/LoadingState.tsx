"use client"

import { css } from "@emotion/css"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import Spinner from "../../components/Spinner"
import { baseTheme } from "../../styles"
import { monospaceFont } from "../../styles/typography"

import {
  DYNAMIC_IMPORT_MAX_ATTEMPTS,
  DYNAMIC_IMPORT_STATE_COMMITTED,
  DYNAMIC_IMPORT_STATE_IMPORT_REJECTED,
  DYNAMIC_IMPORT_STATE_IMPORT_RESOLVED_PENDING_COMMIT,
  DYNAMIC_IMPORT_STATE_INVALID_EXPORT,
  DYNAMIC_IMPORT_STATE_LOADING,
  DYNAMIC_IMPORT_STATE_RENDER_ERROR,
  useDynamicImportStatus,
} from "./dynamicImportStore"

const DYNAMIC_LOADING_SLOW_WARNING_KEY = "dynamic-loading-slow-warning"
const DYNAMIC_LOADING_VERY_SLOW_WARNING_KEY = "dynamic-loading-very-slow-warning"

const DYNAMIC_LOADING_DETECTED_IMPORT_REJECTED_KEY = "dynamic-loading-detected-import-rejected"
const DYNAMIC_LOADING_DETECTED_INVALID_EXPORT_KEY = "dynamic-loading-detected-invalid-export"
const DYNAMIC_LOADING_DETECTED_RESOLVED_NO_COMMIT_KEY =
  "dynamic-loading-detected-resolved-no-commit"
const DYNAMIC_LOADING_DETECTED_RENDER_ERROR_KEY = "dynamic-loading-detected-render-error"
const DYNAMIC_LOADING_RETRYING_KEY = "dynamic-loading-retrying"
const DYNAMIC_LOADING_OFFLINE_KEY = "dynamic-loading-offline"
const DYNAMIC_LOADING_HARD_TIMEOUT_KEY = "dynamic-loading-hard-timeout"

const loadingWarningTextClass = css`
  margin: 0.25rem 0 0;
  max-width: 32rem;
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

const technicalDetailsClass = css`
  margin: 0.5rem 0 0;
  font-family: ${monospaceFont};
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[700]};
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`

const reloadButtonClass = css`
  margin-top: 0.75rem;
  padding: 0.4rem 0.9rem;
  border-radius: 9999px;
  border: 1px solid ${baseTheme.colors.gray[300]};
  background-color: white;
  color: ${baseTheme.colors.gray[800]};
  font-size: 0.9rem;
  cursor: pointer;

  &:hover {
    background-color: ${baseTheme.colors.gray[100]};
  }
`

/**
 * Loading state component that shows a spinner and escalates warnings
 * if loading takes longer than expected.
 */
const LoadingState = ({ debugId }: { debugId: string }) => {
  const [showSlowWarning, setShowSlowWarning] = useState(false)
  const [showVerySlowWarning, setShowVerySlowWarning] = useState(false)
  const [hardTimeout, setHardTimeout] = useState(false)
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  )
  const { t } = useTranslation()

  const status = useDynamicImportStatus(debugId)

  const slowWarningText = t(
    DYNAMIC_LOADING_SLOW_WARNING_KEY,
    "Loading a part of the application is taking longer than expected.",
  )

  const verySlowWarningText = t(
    DYNAMIC_LOADING_VERY_SLOW_WARNING_KEY,
    "This may be due to network issues. If loading does not finish soon, please reload the page.",
  )

  const offlineWarningText = t(
    DYNAMIC_LOADING_OFFLINE_KEY,
    "You appear to be offline. Please check your network connection and try again.",
  )

  useEffect(() => {
    const slowTimeoutId = setTimeout(() => {
      setShowSlowWarning(true)
    }, 5000)

    const verySlowTimeoutId = setTimeout(() => {
      setShowVerySlowWarning(true)
    }, 30000)

    const hardTimeoutId = setTimeout(() => {
      setHardTimeout(true)
    }, 90000)

    return () => {
      clearTimeout(slowTimeoutId)
      clearTimeout(verySlowTimeoutId)
      clearTimeout(hardTimeoutId)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const isHardFailure =
    status?.state === DYNAMIC_IMPORT_STATE_IMPORT_REJECTED ||
    status?.state === DYNAMIC_IMPORT_STATE_INVALID_EXPORT ||
    status?.state === DYNAMIC_IMPORT_STATE_RENDER_ERROR

  const retryAttempt =
    status?.state === DYNAMIC_IMPORT_STATE_LOADING ? status.retryAttempt : undefined

  const maxAttempts =
    status?.state === DYNAMIC_IMPORT_STATE_LOADING && status.maxAttempts
      ? status.maxAttempts
      : DYNAMIC_IMPORT_MAX_ATTEMPTS

  const detectedMessage = useMemo(() => {
    if (!status) {
      return null
    }

    switch (status.state) {
      case DYNAMIC_IMPORT_STATE_IMPORT_REJECTED:
        return {
          title: t(
            DYNAMIC_LOADING_DETECTED_IMPORT_REJECTED_KEY,
            "We tried to load this part of the app, but the import failed.",
          ),
          details: status.errorMessage,
        }
      case DYNAMIC_IMPORT_STATE_INVALID_EXPORT:
        return {
          title: t(
            DYNAMIC_LOADING_DETECTED_INVALID_EXPORT_KEY,
            "We loaded the module, but it did not export a usable React component.",
          ),
          details: status.details,
        }
      case DYNAMIC_IMPORT_STATE_RENDER_ERROR:
        // NOTE: RENDER_ERROR is handled by DynamicImportErrorBoundary after LoadingState
        // unmounts. This branch is included for correctness but is not reachable in normal flow.
        return {
          title: t(
            DYNAMIC_LOADING_DETECTED_RENDER_ERROR_KEY,
            "The component loaded but failed to render.",
          ),
          details: status.errorMessage,
        }
      case DYNAMIC_IMPORT_STATE_IMPORT_RESOLVED_PENDING_COMMIT:
        // NOTE: LoadingState unmounts when wrappedImport resolves, so this
        // state transition happens right as we disappear. Only reachable if
        // next/dynamic somehow re-mounts the loading component after resolution.
        return {
          title: t(
            DYNAMIC_LOADING_DETECTED_RESOLVED_NO_COMMIT_KEY,
            "We loaded the code, but the component has not finished rendering yet.",
          ),
          details: t(
            "dynamic-loading-detected-resolved-no-commit-details",
            "Import resolved; waiting for first React commit (mount).",
          ),
        }
      case DYNAMIC_IMPORT_STATE_COMMITTED:
      default:
        return null
    }
  }, [status, t])

  const retryingText =
    retryAttempt && retryAttempt > 0
      ? t(
          DYNAMIC_LOADING_RETRYING_KEY,
          "Retrying to load this part of the app ({{attempt}}/{{max}})…",
          {
            attempt: retryAttempt,
            max: maxAttempts,
          },
        )
      : null

  const showAnyWarning = showSlowWarning || showVerySlowWarning
  const showDetected = detectedMessage && (isHardFailure || showSlowWarning)
  const showHardTimeoutFallback =
    hardTimeout && status?.state !== DYNAMIC_IMPORT_STATE_COMMITTED && !isHardFailure

  return (
    <div>
      <Spinner />
      {!isOnline && <p className={loadingWarningTextClass}>{offlineWarningText}</p>}
      {(showAnyWarning || showDetected) && (
        <div className={loadingWarningBoxClass}>
          {showSlowWarning && <p className={loadingWarningTextClass}>{slowWarningText}</p>}
          {showVerySlowWarning && <p className={loadingWarningTextClass}>{verySlowWarningText}</p>}
          {retryingText && <p className={loadingWarningTextClass}>{retryingText}</p>}
          {showDetected && (
            <>
              <p className={loadingWarningTextClass}>{detectedMessage.title}</p>
              {detectedMessage.details && (
                <p className={technicalDetailsClass}>{detectedMessage.details}</p>
              )}
              {isHardFailure && (
                <button
                  type="button"
                  className={reloadButtonClass}
                  onClick={() => window.location.reload()}
                >
                  {t("dynamic-loading-reload", "Reload page")}
                </button>
              )}
            </>
          )}
        </div>
      )}
      {showHardTimeoutFallback && (
        <div className={loadingWarningBoxClass}>
          <p className={loadingWarningTextClass}>
            {t(
              DYNAMIC_LOADING_HARD_TIMEOUT_KEY,
              "Loading has stalled. Please try reloading the page.",
            )}
          </p>
          <button
            type="button"
            className={reloadButtonClass}
            onClick={() => window.location.reload()}
          >
            {t("dynamic-loading-reload", "Reload page")}
          </button>
        </div>
      )}
    </div>
  )
}

LoadingState.displayName = "DynamicImportLoadingState"

export default LoadingState
