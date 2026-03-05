"use client"

import type { ComponentType } from "react"
import { useTranslation } from "react-i18next"

import type { DynamicImportStatus } from "./dynamicImportStore"
import { getDynamicImportStatus } from "./dynamicImportStore"

type DynamicImportFallbackModule = { default: ComponentType<unknown> }

/**
 * Creates a localized fallback component module for a failed dynamic import.
 */
export const createDynamicImportFallbackModule = (
  id: string,
  initialStatus?: DynamicImportStatus,
): DynamicImportFallbackModule => {
  const status = initialStatus ?? getDynamicImportStatus(id)
  const reason =
    (status && "errorMessage" in status && status.errorMessage) ||
    (status && "details" in status && status.details) ||
    (status && "lastErrorMessage" in status && status.lastErrorMessage) ||
    undefined

  const Fallback = () => {
    const { t } = useTranslation()

    if (typeof window === "undefined") {
      return null
    }

    return (
      <div>
        <p>
          {t("dynamic-loading-fallback-title", "We were unable to load this part of the page.")}
        </p>
        {reason && <p>{t("dynamic-loading-fallback-reason", "Reason: {{reason}}", { reason })}</p>}
        <button
          type="button"
          onClick={() => {
            if (typeof window.location?.reload === "function") {
              window.location.reload()
            }
          }}
        >
          {t("dynamic-loading-reload", "Reload page")}
        </button>
      </div>
    )
  }

  Fallback.displayName = "DynamicImportFailed"

  return { default: Fallback }
}

export default createDynamicImportFallbackModule
