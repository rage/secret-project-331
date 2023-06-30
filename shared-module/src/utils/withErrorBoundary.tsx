import React, { ComponentClass, ComponentType, ErrorInfo } from "react"
import { Translation } from "react-i18next"
interface ErrorBoundaryState {
  showTrace: boolean
  error?: string
  trace?: string
}

export default function withErrorBoundary<T>(
  Component: ComponentType<React.PropsWithChildren<React.PropsWithChildren<T>>>,
): ComponentClass<T> {
  class ErrorBoundary extends React.Component<T, ErrorBoundaryState> {
    constructor(props: T) {
      super(props)
      this.state = { showTrace: false }
    }

    static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
      return { showTrace: false, error: `${error}`, trace: undefined }
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
      this.setState({ error: error.message, trace: info.componentStack })
    }

    render() {
      const { showTrace, error, trace } = this.state

      if (error) {
        return (
          <Translation>
            {(t) => (
              <>
                <p>
                  {t("error-part-of-page-has-crashed-error", { error })}
                  {Component.displayName && <>({Component.displayName})</>}
                </p>
                {trace && (
                  <>
                    <button onClick={() => this.setState({ showTrace: !showTrace })}>
                      {showTrace ? t("hide-trace") : t("show-trace")}
                    </button>
                    {showTrace && <pre>{trace}</pre>}
                  </>
                )}
              </>
            )}
          </Translation>
        )
      }

      return <Component {...this.props} />
    }
  }

  return ErrorBoundary
}
