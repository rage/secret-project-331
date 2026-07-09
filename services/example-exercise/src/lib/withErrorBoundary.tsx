import React, { ComponentClass, ComponentType, ErrorInfo } from "react"
import { Translation } from "react-i18next"

interface ErrorBoundaryState {
  error?: string
}

/**
 * Wraps a component in a React error boundary so that a render error shows a small message instead
 * of crashing the whole iframe. Full exercise services use the richer error boundary from the
 * exercise-react package which also reports the error; the example keeps a lean, dependency-free
 * version that just logs to the console.
 */
export default function withErrorBoundary<T>(Component: ComponentType<T>): ComponentClass<T> {
  class ErrorBoundary extends React.Component<T, ErrorBoundaryState> {
    constructor(props: T) {
      super(props)
      this.state = {}
    }

    static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
      return { error: error instanceof Error ? error.message : String(error) }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
      console.error("ErrorBoundary caught an error:", error, info.componentStack)
    }

    render() {
      const { error } = this.state
      if (error !== undefined) {
        return (
          <Translation>
            {(t) => <div role="alert">{t("something-went-wrong", { error })}</div>}
          </Translation>
        )
      }
      return <Component {...this.props} />
    }
  }

  return ErrorBoundary
}
