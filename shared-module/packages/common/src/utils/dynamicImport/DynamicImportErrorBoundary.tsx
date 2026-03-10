"use client"

import React from "react"

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
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <p>Something went wrong loading this part of the page.</p>
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <button type="button" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default DynamicImportErrorBoundary
