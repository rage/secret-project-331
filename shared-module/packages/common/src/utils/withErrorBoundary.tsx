"use client"

import type { ComponentClass, ComponentType, ErrorInfo } from "react"
import React from "react"
import { Translation } from "react-i18next"

import ErrorBanner from "../components/ErrorBanner"
import { reportErrorOccurrence } from "../errors/reportErrorOccurrence"

interface ErrorBoundaryState {
  showTrace: boolean
  error?: string
  trace?: string | undefined
}

export default function withErrorBoundary<T>(Component: ComponentType<T>): ComponentClass<T> {
  class ErrorBoundary extends React.Component<T, ErrorBoundaryState> {
    public constructor(props: T) {
      super(props)
      this.state = { showTrace: false }
    }

    public static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      return {
        showTrace: false,
        error: errorObj.message,
        trace: errorObj.stack,
      }
    }

    public override componentDidCatch(error: Error, info: ErrorInfo) {
      console.group(
        `ErrorBoundary caught an error in ${
          Component.displayName ?? "unknown"
        } expand for more info`,
      )
      console.error(`Error.message: ${error.message}`)
      console.error(`Error.stack: ${error.stack}`)
      console.error(`ErrorInfo.componentStack: ${info.componentStack}`)

      console.groupEnd()

      const combinedStack = [error.stack, info.componentStack]
        .filter((s): s is string => typeof s === "string" && s.trim() !== "")
        .join("\n\n")
      void reportErrorOccurrence({
        // oxlint-disable-next-line i18next/no-literal-string
        error_source: "frontend",
        message: error.message,
        stack_trace: combinedStack || null,
        details: {
          // oxlint-disable-next-line i18next/no-literal-string
          kind: "react-error-boundary",
          component: Component.displayName ?? null,
        },
      })

      if (this.state.error !== undefined) {
        console.warn(`ErrorBoundary caught multiple errors. Showing only the first one.`)
        return
      }
      this.setState({ error: error.message, trace: info.componentStack ?? undefined })
    }

    public override render() {
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

      // oxlint-disable-next-line typescript/ban-ts-comment
      // @ts-ignore: Shared module might have a diffrerent react version
      return <Component {...this.props} />
    }
  }

  return ErrorBoundary
}
