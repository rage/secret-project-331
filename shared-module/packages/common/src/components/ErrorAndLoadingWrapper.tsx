import { UseQueryResult } from "@tanstack/react-query"
import { ReactElement } from "react"

import ErrorBanner from "./ErrorBanner"
import Spinner from "./Spinner"

interface ErrorAndLoadingWrapperProps<T> {
  queryResult: UseQueryResult<T>
  render: (result: T) => ReactElement
}

const ErrorAndLoadingWrapper = <T,>({ queryResult, render }: ErrorAndLoadingWrapperProps<T>) => {
  if (queryResult.isError) {
    return <ErrorBanner error={queryResult.error} variant="readOnly" />
  }
  if (queryResult.isLoading || queryResult.data === undefined) {
    return <Spinner variant="medium" />
  }
  return render(queryResult.data)
}

export default ErrorAndLoadingWrapper
