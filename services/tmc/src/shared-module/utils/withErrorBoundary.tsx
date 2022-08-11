import React, { ComponentClass, ComponentType, ErrorInfo } from "react"
import { Translation } from "react-i18next"
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
      return { showTrace: false, error: `${error}`, trace: undefined }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
      this.setState({ error: error.message, trace: info.componentStack })
    }

    render() {
      const { showTrace, error, trace } = this.state

      if (error) {
        return (
          <Translation>
            {(t) => (
              <>
                <p>{t("error-part-of-page-has-crashed-error", { error })}</p>
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
