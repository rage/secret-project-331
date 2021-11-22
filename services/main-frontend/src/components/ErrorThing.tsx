/* eslint-disable @typescript-eslint/no-explicit-any */

import React from "react"
import { useTranslation } from "react-i18next"

import { ErrorResponse } from "../shared-module/bindings"
import { isErrorResponse } from "../shared-module/bindings.guard"

interface Props {
  error: any
}

// error should be the `error` from a useQuery hook
const ErrorThing: React.FC<Props> = ({ error }) => {
  const { t } = useTranslation()

  if (typeof error === "object" && error !== null) {
    if (isErrorResponse(error.data)) {
      // response data contains an error response
      const data: ErrorResponse = error.data
      return (
        <>
          <div>
            {t("error-title")}: {data.title}
          </div>
          <div>{data.message}</div>
          <div>{data.source}</div>
        </>
      )
    } else if (
      error.status !== undefined &&
      error.statusText !== undefined &&
      typeof error.request === "object" &&
      error.request.responseURL !== undefined
    ) {
      // error contains a response but no ErrorResponse
      return (
        <>
          <div>{t("error-title")}</div>
          <div>
            {error.status}: {error.statusText}
          </div>
          <div>{error.request.responseURL}</div>
          {error.data && <div>{JSON.stringify(error.data, undefined, 2)}</div>}
        </>
      )
    }
  }

  return (
    <>
      <div>{t("error-title")}</div>
      <pre>{JSON.stringify(error, undefined, 2)}</pre>
    </>
  )
}

export default ErrorThing
