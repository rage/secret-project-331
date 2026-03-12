"use client"

import React from "react"
import { Translation } from "react-i18next"

interface DynamicImportErrorBoundaryProps {
  onError: (error: unknown, info?: React.ErrorInfo) => void
  children: React.ReactNode
}

interface DynamicImportErrorBoundaryState {
  hasError: boolean
}

/**
 * Error boundary that reports render errors from dynamically imported components.
 * Recovery requires remounting the boundary (or full page reload), which matches
 * the fallback UI's reload action.
 */
class DynamicImportErrorBoundary extends React.Component<
  DynamicImportErrorBoundaryProps,
  DynamicImportErrorBoundaryState
> {
  state: DynamicImportErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): DynamicImportErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    this.props.onError(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <p>
            <Translation>
              {(t) =>
                t(
                  "dynamic-import-error-boundary-title",
                  "Something went wrong loading this part of the page.",
                )
              }
            </Translation>
          </p>
          <button
            type="button"
            onClick={() => {
              if (typeof window.location?.reload === "function") {
                window.location.reload()
              }
            }}
          >
            <Translation>
              {(t) => t("dynamic-import-error-boundary-reload", "Reload page")}
            </Translation>
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default DynamicImportErrorBoundary
