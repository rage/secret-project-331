"use client"

import { css } from "@emotion/css"
import React, { ComponentClass, ComponentType, ErrorInfo } from "react"
import { Translation } from "react-i18next"

import { reportErrorOccurrence } from "@/shared-module/exercise-client/errors/reportErrorOccurrence"

interface ErrorBoundaryState {
  error?: string
  trace?: string
}

const bannerClass = css`
  margin: 1rem 0;
  padding: 1rem 1.5rem;
  border: 1px solid #d5b7ba;
  border-left: 4px solid #822630;
  border-radius: 4px;
  background-color: #f7f3f4;
  color: #57141c;

  details {
    margin-top: 0.5rem;
  }

  summary {
    cursor: pointer;
  }

  pre {
    margin-top: 0.5rem;
    padding: 0.5rem;
    overflow-x: auto;
    border-radius: 4px;
    background-color: rgba(0, 0, 0, 0.05);
    font-size: 0.85rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
`

/**
 * Wraps a component in a React error boundary. On error it reports the occurrence to the
 * platform's error endpoint and renders a minimal inline fallback (message + collapsible stack
 * trace) instead of letting the whole tree crash.
 */
export default function withErrorBoundary<T>(Component: ComponentType<T>): ComponentClass<T> {
  class ErrorBoundary extends React.Component<T, ErrorBoundaryState> {
    constructor(props: T) {
      super(props)
      this.state = {}
    }

    static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      return { error: errorObj.message, trace: errorObj.stack }
    }

    override componentDidCatch(error: Error, info: ErrorInfo) {
      console.error(
        `ErrorBoundary caught an error in ${Component.displayName ?? "unknown"}`,
        error,
        info.componentStack,
      )

      const combinedStack = [error.stack, info.componentStack]
        .filter((s): s is string => typeof s === "string" && s.trim() !== "")
        .join("\n\n")
      void reportErrorOccurrence({
        // eslint-disable-next-line i18next/no-literal-string
        error_source: "frontend",
        message: error.message,
        stack_trace: combinedStack || null,
        details: {
          // eslint-disable-next-line i18next/no-literal-string
          kind: "react-error-boundary",
          component: Component.displayName ?? null,
        },
      })
    }

    override render() {
      const { error, trace } = this.state

      if (error) {
        return (
          <Translation>
            {(t) => (
              <div className={bannerClass} role="alert">
                <div>
                  {t("error-part-of-page-has-crashed-error", { error })}
                  {Component.displayName && <> ({Component.displayName})</>}
                </div>
                {trace && (
                  <details>
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <summary>Details</summary>
                    <pre>{trace}</pre>
                  </details>
                )}
              </div>
            )}
          </Translation>
        )
      }

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore: Shared module might have a diffrerent react version
      return <Component {...this.props} />
    }
  }

  return ErrorBoundary
}
