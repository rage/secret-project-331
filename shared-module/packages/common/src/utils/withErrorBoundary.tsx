"use client"

import React, { ComponentClass, ComponentType, ErrorInfo } from "react"
import { Translation } from "react-i18next"

import ErrorBanner from "../components/ErrorBanner"

interface ErrorBoundaryState {
  showTrace: boolean
  error?: string
  trace?: string
}

export default function withErrorBoundary<T>(Component: ComponentType<T>): ComponentClass<T> {
  class ErrorBoundary extends React.Component<T, ErrorBoundaryState> {
    constructor(props: T) {
      super(props)
      this.state = { showTrace: false }
    }

    static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      return {
        showTrace: false,
        error: errorObj.message,
        trace: errorObj.stack,
      }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
      console.group(
        `ErrorBoundary caught an error in ${
          Component.displayName ?? "unknown"
        } expand for more info`,
      )
      console.error(`Error.message: ${error.message}`)
      console.error(`Error.stack: ${error.stack}`)
      console.error(`ErrorInfo.componentStack: ${info.componentStack}`)

      console.groupEnd()
      if (this.state.error !== undefined) {
        console.warn(`ErrorBoundary caught multiple errors. Showing only the first one.`)
        return
      }
      this.setState({ error: error.message, trace: info.componentStack ?? undefined })
    }

    render() {
      const { error, trace } = this.state

      if (error) {
        const context = (
          <Translation>
            {(t) => (
              <>
                {t("error-part-of-page-has-crashed-error", { error })}
                {Component.displayName && <> ({Component.displayName})</>}
              </>
            )}
          </Translation>
        )
        const structuredError =
          trace !== undefined ? { message: error, stack: trace } : { message: error }

        return (
          <ErrorBanner variant="frontendCrash" error={structuredError} contextMessage={context} />
        )
      }

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore: Shared module might have a diffrerent react version
      return <Component {...this.props} />
    }
  }

  return ErrorBoundary
}
